import "server-only";

import type { BillSchedule } from "../../../generated/prisma";
import { amortizationRow } from "~/lib/amortization";
import { addDays, calendarDayOf, dateOnly } from "~/lib/calendar-day";
import { BILL_TYPE_LABELS, EVENT_CATEGORY_LABELS } from "~/lib/labels";
import { reminderCategoryConfig } from "~/lib/reminders";
import {
  BILL_LOOKBACK_DAYS,
  billingPeriodOf,
  nextOccurrence,
  occurrencesBetween,
} from "~/lib/schedule";
import { resolveTimeZone, todayInTimeZone } from "~/lib/time-zone";
import { db } from "~/server/db";
import { createBill, isUniqueConstraintError, scheduleBillKey } from "./create";
import { NOT_SOFT_DELETED } from "~/server/queries/shared";

/**
 * The bill generator: turns each active recurring `BillSchedule` (a
 * utility, a loan's EMIs…) into the actual `Bill` rows that the dashboard,
 * timeline and reminders work from.
 *
 * Each run creates every missing bill whose due day falls from
 * `LOOKBACK_DAYS` ago to `HORIZON_DAYS` ahead (in the owner's time zone):
 * far enough ahead for the earliest reminder (30 days before), and far
 * enough back to catch up after missed runs — but never before the
 * schedule's `billFrom`, the day its terms were last set, so adding an old
 * loan or moving a due day doesn't produce bills for days already gone.
 *
 * A schedule bills each period (a month, or a weekly schedule's day) once:
 * a period that already has a bill is skipped whatever day that bill is
 * on, and each bill's `generationKey` names its period and is unique in
 * the database, so even two runs at the same moment can't both insert it.
 * The job can run as often as needed: daily by `/api/cron/bills`, on
 * demand from the admin portal, and for a single schedule right after
 * it's created.
 *
 * One schedule that fails (bad data, a database error) is logged and
 * counted in `failed`; the rest of the run carries on, and that schedule
 * is tried again next run.
 *
 * Each schedule remembers its `nextDueDate` — the first day it hasn't
 * billed yet — so a run reads only the schedules with something due within
 * the horizon (an index on `active, nextDueDate`), not every schedule.
 */

export const HORIZON_DAYS = 35;
export const LOOKBACK_DAYS = BILL_LOOKBACK_DAYS;
export const BATCH_SIZE = 200;
export const TIME_BUDGET_MS = 240_000;
const DAY_MS = 86_400_000;

export interface GenerateBillsSummary {
  schedulesScanned: number;
  billsCreated: number;
  /** Schedules with no amount to bill (nothing to create). */
  skippedNoAmount: number;
  /** Schedules that threw; they're retried on the next run. */
  failed: number;
  /** The first failure's message, for the job's health record. */
  firstError?: string;
  hasMore: boolean;
}

const ACTIVE_SCHEDULE = {
  active: true,
  ...NOT_SOFT_DELETED,
};

export async function generateBills(
  now = new Date(),
  { timeBudgetMs = TIME_BUDGET_MS, clock = () => Date.now() } = {},
): Promise<GenerateBillsSummary> {
  const startedAt = clock();
  const summary: GenerateBillsSummary = {
    schedulesScanned: 0,
    billsCreated: 0,
    skippedNoAmount: 0,
    failed: 0,
    hasMore: false,
  };
  let cursor: string | undefined;

  // Schedules with a bill due by the horizon's end anywhere in the world
  // (a day past UTC's, for zones ahead of it), or not yet given a date.
  const dueBy = dateOnly(
    addDays(todayInTimeZone("UTC", now), HORIZON_DAYS + 1),
  );
  for (;;) {
    const schedules = await db.billSchedule.findMany({
      where: {
        ...ACTIVE_SCHEDULE,
        AND: [
          {
            OR: [
              { nextDueDate: { lte: dueBy } },
              { nextDueDate: { isSet: false } },
            ],
          },
        ],
      },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (schedules.length === 0) break;

    const batch = await generateBillsForSchedules(schedules, now);
    summary.billsCreated += batch.billsCreated;
    summary.skippedNoAmount += batch.skippedNoAmount;
    summary.failed += batch.failed;
    summary.firstError ??= batch.firstError;
    summary.schedulesScanned += schedules.length;
    cursor = schedules[schedules.length - 1]!.id;

    if (schedules.length < BATCH_SIZE) break;
    if (clock() - startedAt >= timeBudgetMs) {
      summary.hasMore = true;
      break;
    }
  }

  return summary;
}

/** Generates bills for one schedule — e.g. right after it's created. */
export async function generateBillsForSchedule(
  scheduleId: string,
  now = new Date(),
) {
  const schedule = await db.billSchedule.findFirst({
    where: { id: scheduleId, ...ACTIVE_SCHEDULE },
  });
  if (!schedule) return { billsCreated: 0, skippedNoAmount: 0, failed: 0 };
  return generateBillsForSchedules([schedule], now);
}

async function generateBillsForSchedules(schedules: BillSchedule[], now: Date) {
  const ids = (
    key: "propertyId" | "loanId" | "policyId" | "leaseId" | "investmentId",
  ) => [...new Set(schedules.flatMap((s) => (s[key] ? [s[key]] : [])))];
  const ownerIds = [...new Set(schedules.map((s) => s.ownerId))];

  const [owners, properties, loans, policies, leases, investments, existing] =
    await Promise.all([
      db.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, timezone: true },
      }),
      db.property.findMany({
        where: { id: { in: ids("propertyId") } },
        select: { id: true, name: true },
      }),
      db.loan.findMany({
        where: { id: { in: ids("loanId") } },
        select: {
          id: true,
          lender: true,
          type: true,
          principal: true,
          interestRatePercent: true,
        },
      }),
      db.policy.findMany({
        where: { id: { in: ids("policyId") } },
        select: { id: true, insurer: true },
      }),
      db.lease.findMany({
        where: { id: { in: ids("leaseId") } },
        select: { id: true, tenantName: true },
      }),
      db.investment.findMany({
        where: { id: { in: ids("investmentId") } },
        select: { id: true, name: true },
      }),
      // Bills these schedules already have, to never bill a period twice.
      // A month wider than the window each side, to see the whole of the
      // months at its edges.
      db.bill.findMany({
        where: {
          billScheduleId: { in: schedules.map((s) => s.id) },
          dueDate: {
            gte: new Date(now.getTime() - (LOOKBACK_DAYS + 33) * DAY_MS),
            lte: new Date(now.getTime() + (HORIZON_DAYS + 33) * DAY_MS),
          },
        },
        select: { billScheduleId: true, dueDate: true },
      }),
    ]);

  const timeZoneOf = new Map(
    owners.map((owner) => [owner.id, resolveTimeZone(owner.timezone)]),
  );
  const names = {
    property: new Map(properties.map((p) => [p.id, p.name])),
    loan: new Map(loans.map((l) => [l.id, l.lender])),
    policy: new Map(policies.map((p) => [p.id, p.insurer])),
    lease: new Map(leases.map((l) => [l.id, l.tenantName])),
    investment: new Map(investments.map((i) => [i.id, i.name])),
  };
  const loanById = new Map(loans.map((loan) => [loan.id, loan]));
  const recurrenceOf = new Map(schedules.map((s) => [s.id, s.recurrence]));
  const alreadyBilled = new Set(
    existing.flatMap((bill) => {
      const recurrence =
        bill.billScheduleId && recurrenceOf.get(bill.billScheduleId);
      return recurrence
        ? [
            scheduleBillKey(
              bill.billScheduleId!,
              billingPeriodOf(recurrence, calendarDayOf(bill.dueDate)),
            ),
          ]
        : [];
    }),
  );

  let billsCreated = 0;
  let skippedNoAmount = 0;
  let failed = 0;
  let firstError: string | undefined;
  for (const schedule of schedules) {
    try {
      const result = await generateForSchedule(schedule);
      billsCreated += result.billsCreated;
      skippedNoAmount += result.skippedNoAmount;
    } catch (error) {
      // One bad schedule must not stop the others; it's retried next run
      // (its `nextDueDate` hasn't moved).
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      firstError ??= `Schedule ${schedule.id}: ${message}`;
      console.error(`[bills] Schedule ${schedule.id} failed`, error);
    }
  }
  return { billsCreated, skippedNoAmount, failed, firstError };

  async function generateForSchedule(schedule: BillSchedule) {
    let billsCreated = 0;
    const today = todayInTimeZone(
      timeZoneOf.get(schedule.ownerId) ?? resolveTimeZone(null),
      now,
    );
    if (schedule.defaultAmount == null || schedule.defaultAmount <= 0) {
      // Nothing to bill until its terms change (which sets a new date).
      await recordNextDueDate(schedule, null);
      return { billsCreated, skippedNoAmount: 1 };
    }
    // Catch up after missed runs, but not past the day the terms were set.
    const windowStart = addDays(today, -LOOKBACK_DAYS);
    const billFrom = schedule.billFrom
      ? calendarDayOf(schedule.billFrom)
      : null;
    const due = occurrencesBetween(
      schedule,
      billFrom && billFrom > windowStart ? billFrom : windowStart,
      addDays(today, HORIZON_DAYS),
    );

    for (const { day, installment } of due) {
      const key = scheduleBillKey(
        schedule.id,
        billingPeriodOf(schedule.recurrence, day),
      );
      if (alreadyBilled.has(key)) continue;

      // An EMI's split into interest and principal, from the loan's terms.
      const loan =
        schedule.category === "EMI" && schedule.loanId
          ? loanById.get(schedule.loanId)
          : undefined;
      const split =
        loan && loan.principal > 0
          ? amortizationRow(
              loan.principal,
              loan.interestRatePercent,
              schedule.defaultAmount,
              installment,
            )
          : undefined;

      try {
        await createBill({
          ownerId: schedule.ownerId,
          householdId: schedule.householdId ?? undefined,
          generationKey: key,
          category: schedule.category,
          direction: reminderCategoryConfig(schedule.category).incoming
            ? "INFLOW"
            : "OUTFLOW",
          billScheduleId: schedule.id,
          propertyId: schedule.propertyId ?? undefined,
          leaseId: schedule.leaseId ?? undefined,
          loanId: schedule.loanId ?? undefined,
          policyId: schedule.policyId ?? undefined,
          investmentId: schedule.investmentId ?? undefined,
          amount: schedule.defaultAmount,
          currency: schedule.currency,
          dueDay: day,
          description: describe(schedule, names),
          installmentNumber: schedule.tenureMonths ? installment : undefined,
          principalComponent: split?.principal,
          interestComponent: split?.interest,
        });
        billsCreated += 1;
      } catch (error) {
        // Another run created this bill between our read and our insert.
        if (!isUniqueConstraintError(error)) throw error;
      }
      alreadyBilled.add(key);
    }

    // The next day to bill is the first one past this run's horizon (or
    // the start, if that's later still); none once the schedule has ended.
    const pastHorizon = addDays(today, HORIZON_DAYS + 1);
    const start = schedule.startDate ? calendarDayOf(schedule.startDate) : null;
    const next = nextOccurrence(
      schedule,
      start && start > pastHorizon ? start : pastHorizon,
    );
    await recordNextDueDate(schedule, next ? dateOnly(next.day) : null);
    return { billsCreated, skippedNoAmount: 0 };
  }
}

async function recordNextDueDate(schedule: BillSchedule, next: Date | null) {
  // Unchanged dates need no write. Null is always written: a field that was
  // never set also reads as null, and only a stored null stops the scans.
  if (next && schedule.nextDueDate?.getTime() === next.getTime()) return;
  await db.billSchedule.update({
    where: { id: schedule.id },
    data: { nextDueDate: next },
  });
}

/** "BESCOM electricity · Indiranagar 2BHK", "Home loan EMI · SBI", … */
function describe(
  schedule: BillSchedule,
  names: Record<
    "property" | "loan" | "policy" | "lease" | "investment",
    Map<string, string>
  >,
) {
  const parts: (string | undefined)[] = [];
  switch (schedule.category) {
    case "UTILITY_BILL": {
      const kind = schedule.billType
        ? BILL_TYPE_LABELS[schedule.billType].toLowerCase()
        : "bill";
      parts.push(
        schedule.provider
          ? `${schedule.provider} ${kind}`
          : BILL_TYPE_LABELS[schedule.billType ?? "OTHER"],
      );
      parts.push(
        schedule.propertyId
          ? names.property.get(schedule.propertyId)
          : undefined,
      );
      break;
    }
    case "EMI":
      parts.push("Loan EMI");
      parts.push(schedule.loanId ? names.loan.get(schedule.loanId) : undefined);
      break;
    case "PREMIUM":
      parts.push(
        schedule.policyId && names.policy.get(schedule.policyId)
          ? `${names.policy.get(schedule.policyId)} premium`
          : "Insurance premium",
      );
      break;
    case "RENT":
      parts.push("Rent");
      parts.push(
        schedule.leaseId ? names.lease.get(schedule.leaseId) : undefined,
      );
      break;
    case "PAYOUT":
      parts.push(
        schedule.policyId && names.policy.get(schedule.policyId)
          ? `${names.policy.get(schedule.policyId)} payout`
          : "Payout",
      );
      break;
    case "INVESTMENT_RETURN":
      parts.push("Return");
      parts.push(
        schedule.investmentId
          ? names.investment.get(schedule.investmentId)
          : undefined,
      );
      break;
    default:
      parts.push(EVENT_CATEGORY_LABELS[schedule.category]);
  }
  return parts.filter(Boolean).join(" · ");
}
