import "server-only";

import { addDays, dateOnly } from "~/lib/calendar-day";
import { DEFAULT_TIME_ZONE, todayInTimeZone } from "~/lib/time-zone";
import { db } from "~/server/db";
import { OPEN_PAYMENT_STATUSES } from "~/server/queries/shared";

/**
 * Aggregates the numbers the Dashboard page renders: net worth (property +
 * investment value, minus loan outstanding), total active-policy coverage,
 * upcoming outflows/inflows due within 30 days, and a short "needs
 * attention" list (overdue, or due within 7 days).
 */
export async function getDashboardData(
  ownerId: string,
  timeZone: string = DEFAULT_TIME_ZONE,
  now: Date = new Date(),
) {
  // Due dates are date-only values, so the windows are calendar days
  // counted from today where the user is.
  const today = todayInTimeZone(timeZone, now);
  const in7Days = dateOnly(addDays(today, 7));
  const in30Days = dateOnly(addDays(today, 30));

  const [
    propertyValue,
    investmentValue,
    loanOutstanding,
    coverage,
    outflows,
    inflows,
    attentionItems,
    upcoming,
  ] = await Promise.all([
    db.property.aggregate({
      where: { ownerId },
      _sum: { currentEstimatedValue: true },
    }),
    db.investment.aggregate({
      where: { ownerId },
      _sum: { currentEstimatedValue: true },
    }),
    db.loan.aggregate({
      where: { ownerId },
      _sum: { outstandingBalance: true },
    }),
    db.policy.aggregate({
      where: { ownerId, status: "ACTIVE" },
      _sum: { sumAssured: true },
    }),
    db.bill.aggregate({
      where: {
        ownerId,
        direction: "OUTFLOW",
        status: { in: [...OPEN_PAYMENT_STATUSES] },
        dueDate: { lte: in30Days },
      },
      _sum: { amount: true },
    }),
    db.bill.aggregate({
      where: {
        ownerId,
        direction: "INFLOW",
        status: { in: [...OPEN_PAYMENT_STATUSES] },
        dueDate: { lte: in30Days },
      },
      _sum: { amount: true },
    }),
    db.bill.findMany({
      where: {
        ownerId,
        OR: [
          { status: "OVERDUE" },
          { status: "DUE", dueDate: { lte: in7Days } },
        ],
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    // The next few open bills from today on, in either direction — the
    // dashboard's "Coming up" strip.
    db.bill.findMany({
      where: {
        ownerId,
        status: { in: [...OPEN_PAYMENT_STATUSES] },
        dueDate: { gte: dateOnly(today) },
      },
      orderBy: { dueDate: "asc" },
      take: 6,
    }),
  ]);

  const totals = {
    propertyValue: propertyValue._sum.currentEstimatedValue ?? 0,
    investmentValue: investmentValue._sum.currentEstimatedValue ?? 0,
    loanOutstanding: loanOutstanding._sum.outstandingBalance ?? 0,
  };
  const netWorth =
    totals.propertyValue + totals.investmentValue - totals.loanOutstanding;

  return {
    ...totals,
    netWorth,
    totalCoverage: coverage._sum.sumAssured ?? 0,
    upcomingOutflows: outflows._sum.amount ?? 0,
    expectedInflows: inflows._sum.amount ?? 0,
    attentionItems,
    upcoming,
  };
}
