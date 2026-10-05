import "server-only";

import type { BillSchedule } from "../../../generated/prisma";
import { addDays, dateOnly } from "~/lib/calendar-day";
import { BILL_TYPE_LABELS, EVENT_CATEGORY_LABELS } from "~/lib/labels";
import { reminderCategoryConfig } from "~/lib/reminders";
import { occurrencesBetween } from "~/lib/schedule";
import { resolveTimeZone, todayInTimeZone } from "~/lib/time-zone";
import { generateBill } from "~/server/actions/bills";
import { db } from "~/server/db";
import { NOT_SOFT_DELETED } from "~/server/queries/shared";

/**
 * The bill generator: turns each active recurring `BillSchedule` (a
 * utility, a loan's EMIs…) into the actual `Bill` rows that the dashboard,
 * timeline and reminders work from.
 *
 * Each run creates every missing bill whose due day falls from
 * `LOOKBACK_DAYS` ago to `HORIZON_DAYS` ahead (in the owner's time zone):
 * far enough ahead for the earliest reminder (30 days before), and far
 * enough back to catch up after missed runs. A bill that already exists
 * for a schedule and day is never created twice, so the job can run as
 * often as needed — daily by `/api/cron/bills`, on demand from the admin
 * portal, and for a single schedule right after it's created.
 */

export const HORIZON_DAYS = 35;
export const LOOKBACK_DAYS = 31;
export const BATCH_SIZE = 200;
export const TIME_BUDGET_MS = 45_000;

export interface GenerateBillsSummary {
  schedulesScanned: number;
  billsCreated: number;
  /** Schedules with no amount to bill (nothing to create). */
  skippedNoAmount: number;
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
    hasMore: false,
  };
  let cursor: string | undefined;

  for (;;) {
    const schedules = await db.billSchedule.findMany({
      where: ACTIVE_SCHEDULE,
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (schedules.length === 0) break;

    const batch = await generateBillsForSchedules(schedules, now);
    summary.billsCreated += batch.billsCreated;
    summary.skippedNoAmount += batch.skippedNoAmount;
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
  if (!schedule) return { billsCreated: 0, skippedNoAmount: 0 };
  return generateBillsForSchedules([schedule], now);
}

async function generateBillsForSchedules(schedules: BillSchedule[], now: Date) {
  const ids = (key: "propertyId" | "loanId" | "policyId" | "leaseId") => [
    ...new Set(schedules.flatMap((s) => (s[key] ? [s[key]] : []))),
  ];
  const ownerIds = [...new Set(schedules.map((s) => s.ownerId))];

  const [owners, properties, loans, policies, leases, existing] =
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
        select: { id: true, lender: true, type: true },
      }),
      db.policy.findMany({
        where: { id: { in: ids("policyId") } },
        select: { id: true, insurer: true },
      }),
      db.lease.findMany({
        where: { id: { in: ids("leaseId") } },
        select: { id: true, tenantName: true },
      }),
      // Bills already generated for these schedules, to never duplicate.
      db.bill.findMany({
        where: {
          billScheduleId: { in: schedules.map((s) => s.id) },
          dueDate: {
            gte: new Date(now.getTime() - (LOOKBACK_DAYS + 2) * 86_400_000),
            lte: new Date(now.getTime() + (HORIZON_DAYS + 2) * 86_400_000),
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
  };
  const alreadyBilled = new Set(
    existing.map(
      (bill) => `${bill.billScheduleId}:${bill.dueDate.toISOString()}`,
    ),
  );

  let billsCreated = 0;
  let skippedNoAmount = 0;
  for (const schedule of schedules) {
    if (schedule.defaultAmount == null || schedule.defaultAmount <= 0) {
      skippedNoAmount += 1;
      continue;
    }
    const today = todayInTimeZone(
      timeZoneOf.get(schedule.ownerId) ?? resolveTimeZone(null),
      now,
    );
    const due = occurrencesBetween(
      schedule,
      addDays(today, -LOOKBACK_DAYS),
      addDays(today, HORIZON_DAYS),
    );

    for (const { day, installment } of due) {
      const key = `${schedule.id}:${dateOnly(day).toISOString()}`;
      if (alreadyBilled.has(key)) continue;

      await generateBill({
        ownerId: schedule.ownerId,
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
        dueDay: day,
        description: describe(schedule, names),
        installmentNumber: schedule.tenureMonths ? installment : undefined,
      });
      alreadyBilled.add(key);
      billsCreated += 1;
    }
  }

  return { billsCreated, skippedNoAmount };
}

/** "BESCOM electricity · Indiranagar 2BHK", "Home loan EMI · SBI", … */
function describe(
  schedule: BillSchedule,
  names: Record<"property" | "loan" | "policy" | "lease", Map<string, string>>,
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
    default:
      parts.push(EVENT_CATEGORY_LABELS[schedule.category]);
  }
  return parts.filter(Boolean).join(" · ");
}
