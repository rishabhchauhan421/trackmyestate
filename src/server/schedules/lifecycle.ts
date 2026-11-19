/**
 * The one place a `BillSchedule` is created, changed or retired, so its
 * bills and reminders always follow. Every asset action (leases, loans,
 * policies, investments, utilities) goes through here instead of writing
 * schedules itself.
 *
 * - `saveSchedule` creates an asset's schedule, or updates it. When the
 *   dates or amount change, the upcoming bills nobody has paid are removed
 *   so the generator re-creates them from the new terms.
 * - `retireSchedules` stops schedules when an asset ends (a lease ends, a
 *   utility is switched off) or is deleted.
 *
 * Removing a bill soft-deletes it, frees its `generationKey` (so the
 * generator can create that day's bill again from new terms) and cancels
 * its queued reminders. Paid or part-paid bills are never touched.
 *
 * These take a transaction client: callers wrap the asset write and the
 * schedule write in one `db.$transaction`, then call
 * `generateBillsForSchedule` afterwards.
 */
import "server-only";

import type {
  BillSchedule,
  EventCategory,
  Prisma,
} from "../../../generated/prisma";
import { dateOnly } from "~/lib/calendar-day";
import type { ScheduleTerms } from "~/lib/schedule-terms";
import { todayInTimeZone } from "~/lib/time-zone";
import type { db } from "~/server/db";
import { getUserTimeZone } from "~/server/queries/settings";

/** What these helpers need from `db` or a transaction client. */
export type ScheduleTx = Pick<
  typeof db,
  "bill" | "billSchedule" | "notificationJob"
>;

/** The asset a schedule belongs to. */
export type ScheduleOwner =
  | { leaseId: string }
  | { loanId: string }
  | { policyId: string }
  | { investmentId: string }
  | { propertyId: string }
  | { id: string };

export type { ScheduleTerms };

/** Bills still waiting for payment, with no payment recorded. */
const UNPAID = ["DUE", "OVERDUE"] as const;

/** Today, where the user is, as a date-only value. */
export async function todayFor(userId: string): Promise<Date> {
  return dateOnly(todayInTimeZone(await getUserTimeZone(userId)));
}

/**
 * Removes the unpaid bills of `scheduleIds` due on or after `from` (all of
 * them when `from` is null), and cancels their queued reminders. Returns
 * how many bills were removed.
 */
export async function removeUnpaidBills(
  tx: ScheduleTx,
  scheduleIds: string[],
  from: Date | null,
): Promise<number> {
  if (scheduleIds.length === 0) return 0;
  const bills = await tx.bill.findMany({
    where: {
      billScheduleId: { in: scheduleIds },
      status: { in: [...UNPAID] },
      ...(from ? { dueDate: { gte: from } } : {}),
    },
    select: { id: true },
  });
  if (bills.length === 0) return 0;

  const removedAt = new Date();
  for (const bill of bills) {
    await tx.bill.update({
      where: { id: bill.id },
      data: { deletedAt: removedAt, generationKey: `removed:${bill.id}` },
    });
  }
  await tx.notificationJob.updateMany({
    where: {
      billId: { in: bills.map((bill) => bill.id) },
      status: "SCHEDULED",
    },
    data: { status: "CANCELLED", failedReason: "Bill was removed" },
  });
  return bills.length;
}

const sameDay = (a: Date | null | undefined, b: Date | null | undefined) =>
  (a?.getTime() ?? null) === (b?.getTime() ?? null);

/** Whether `terms` would put bills on different days or amounts. */
export function termsChanged(
  existing: Pick<BillSchedule, keyof ScheduleTerms>,
  terms: ScheduleTerms,
): boolean {
  return (
    existing.recurrence !== terms.recurrence ||
    !sameDay(existing.startDate, terms.startDate) ||
    existing.dueDay !== terms.dueDay ||
    (existing.dueMonth ?? null) !== (terms.dueMonth ?? null) ||
    !sameDay(existing.endDate, terms.endDate) ||
    (existing.tenureMonths ?? null) !== (terms.tenureMonths ?? null) ||
    existing.defaultAmount !== terms.defaultAmount
  );
}

/**
 * Creates `owner`'s `category` schedule, or brings the existing one up to
 * date with `terms` (reactivating it if it was retired). Returns its id.
 */
export async function saveSchedule(
  tx: ScheduleTx,
  {
    owner,
    category,
    data,
    terms,
    today,
  }: {
    owner: ScheduleOwner;
    category: EventCategory;
    /** Fields set only when creating: who owns it and what it's for. */
    data: Omit<
      Prisma.BillScheduleUncheckedCreateInput,
      keyof ScheduleTerms | "category"
    >;
    terms: ScheduleTerms;
    today: Date;
  },
): Promise<string> {
  const existing = await tx.billSchedule.findFirst({
    where: { ...owner, category },
  });
  const values = {
    recurrence: terms.recurrence,
    startDate: terms.startDate,
    dueDay: terms.dueDay,
    dueMonth: terms.dueMonth ?? null,
    endDate: terms.endDate ?? null,
    tenureMonths: terms.tenureMonths ?? null,
    defaultAmount: terms.defaultAmount,
  };

  if (!existing) {
    const created = await tx.billSchedule.create({
      data: { ...data, category, ...values, active: true },
    });
    return created.id;
  }

  if (termsChanged(existing, terms) || !existing.active) {
    await removeUnpaidBills(tx, [existing.id], today);
    await tx.billSchedule.update({
      where: { id: existing.id },
      data: { ...values, active: true },
    });
  }
  return existing.id;
}

/**
 * Stops the schedules matching `where`: no more bills, and the unpaid ones
 * due on or after `from` (usually today) are removed. With `remove` (the asset was
 * deleted) the schedules are soft-deleted too and every unpaid bill goes,
 * overdue ones included — there's nothing left to pay them against.
 * Returns how many schedules were retired.
 */
export async function retireSchedules(
  tx: ScheduleTx,
  where: ScheduleOwner & { category?: EventCategory },
  { from, remove = false }: { from: Date; remove?: boolean },
): Promise<number> {
  const schedules = await tx.billSchedule.findMany({
    where,
    select: { id: true },
  });
  const ids = schedules.map((schedule) => schedule.id);
  if (ids.length === 0) return 0;

  await removeUnpaidBills(tx, ids, remove ? null : from);
  await tx.billSchedule.updateMany({
    where: { id: { in: ids } },
    data: remove ? { active: false, deletedAt: new Date() } : { active: false },
  });
  return ids.length;
}

/**
 * Whether any bill of `owner` has had money recorded against it — the
 * history that stops an asset from being deleted.
 */
export async function hasPaymentHistory(
  tx: Pick<typeof db, "bill">,
  owner: Exclude<ScheduleOwner, { id: string }>,
): Promise<boolean> {
  const paid = await tx.bill.findFirst({
    where: { ...owner, status: { in: ["PAID", "PARTIALLY_PAID", "REFUNDED"] } },
    select: { id: true },
  });
  return paid !== null;
}
