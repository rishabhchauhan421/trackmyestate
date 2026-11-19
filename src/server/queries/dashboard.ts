import "server-only";

import type { Currency } from "../../../generated/prisma";
import { addDays, dateOnly } from "~/lib/calendar-day";
import { addTotals, sumByCurrency } from "~/lib/money-totals";
import { DEFAULT_TIME_ZONE, todayInTimeZone } from "~/lib/time-zone";
import { db } from "~/server/db";
import { OPEN_PAYMENT_STATUSES } from "~/server/queries/shared";

/** The calendar-day windows the dashboard counts in, from today where the user is. */
function dashboardWindows(timeZone: string, now: Date) {
  // Due dates are date-only values, so the windows are calendar days
  // counted from today where the user is.
  const today = todayInTimeZone(timeZone, now);
  return {
    today: dateOnly(today),
    in7Days: dateOnly(addDays(today, 7)),
    in30Days: dateOnly(addDays(today, 30)),
  };
}

/**
 * The dashboard's totals: net worth (property + investment value, minus
 * loan outstanding), total active-policy coverage, and the outflows and
 * inflows due within 30 days.
 *
 * Every figure is a `MoneyTotals` — one sum per currency — since amounts
 * in different currencies can't be added; a record without a currency
 * counts in the user's (`currency`).
 */
export async function getDashboardTotals(
  householdId: string,
  timeZone: string = DEFAULT_TIME_ZONE,
  now: Date = new Date(),
  currency: Currency = "INR",
) {
  const { in30Days } = dashboardWindows(timeZone, now);

  const [
    propertyValue,
    investmentValue,
    loanOutstanding,
    coverage,
    outflows,
    inflows,
  ] = await Promise.all([
    db.property.groupBy({
      by: ["currency"],
      where: { householdId },
      _sum: { currentEstimatedValue: true },
    }),
    db.investment.groupBy({
      by: ["currency"],
      where: { householdId },
      _sum: { currentEstimatedValue: true },
    }),
    db.loan.groupBy({
      by: ["currency"],
      where: { householdId },
      _sum: { outstandingBalance: true },
    }),
    db.policy.groupBy({
      by: ["currency"],
      where: { householdId, status: "ACTIVE" },
      _sum: { sumAssured: true },
    }),
    db.bill.groupBy({
      by: ["currency"],
      where: {
        householdId,
        direction: "OUTFLOW",
        status: { in: [...OPEN_PAYMENT_STATUSES] },
        dueDate: { lte: in30Days },
      },
      _sum: { amount: true },
    }),
    db.bill.groupBy({
      by: ["currency"],
      where: {
        householdId,
        direction: "INFLOW",
        status: { in: [...OPEN_PAYMENT_STATUSES] },
        dueDate: { lte: in30Days },
      },
      _sum: { amount: true },
    }),
  ]);

  const sum = <T extends { currency: Currency | null }>(
    groups: T[],
    amount: (group: T) => number | null,
  ) =>
    sumByCurrency(
      groups.map((group) => ({
        amount: amount(group),
        currency: group.currency,
      })),
      currency,
    );

  const totals = {
    propertyValue: sum(propertyValue, (g) => g._sum.currentEstimatedValue),
    investmentValue: sum(investmentValue, (g) => g._sum.currentEstimatedValue),
    loanOutstanding: sum(loanOutstanding, (g) => g._sum.outstandingBalance),
  };
  const assets = addTotals(totals.propertyValue, totals.investmentValue);
  const netWorth = addTotals(assets, totals.loanOutstanding, -1);

  return {
    ...totals,
    assets,
    netWorth,
    totalCoverage: sum(coverage, (g) => g._sum.sumAssured),
    upcomingOutflows: sum(outflows, (g) => g._sum.amount),
    expectedInflows: sum(inflows, (g) => g._sum.amount),
  };
}

/**
 * The dashboard's two short lists of bills: "needs attention" (overdue, or
 * due within 7 days) and "coming up" (the next few open bills from today).
 */
export async function getDashboardBills(
  householdId: string,
  timeZone: string = DEFAULT_TIME_ZONE,
  now: Date = new Date(),
) {
  const { today, in7Days } = dashboardWindows(timeZone, now);

  const [attentionItems, upcoming] = await Promise.all([
    db.bill.findMany({
      where: {
        householdId,
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
        householdId,
        status: { in: [...OPEN_PAYMENT_STATUSES] },
        dueDate: { gte: today },
      },
      orderBy: { dueDate: "asc" },
      take: 6,
    }),
  ]);

  return { attentionItems, upcoming };
}

/**
 * Everything the dashboard shows, in one call. The page itself asks for
 * the totals and the bills separately so each section can stream in on its
 * own.
 */
export async function getDashboardData(
  householdId: string,
  timeZone: string = DEFAULT_TIME_ZONE,
  now: Date = new Date(),
  currency: Currency = "INR",
) {
  const [totals, bills] = await Promise.all([
    getDashboardTotals(householdId, timeZone, now, currency),
    getDashboardBills(householdId, timeZone, now),
  ]);
  return { ...totals, ...bills };
}
