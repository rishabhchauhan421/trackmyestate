import "server-only";

import type { Currency } from "../../../generated/prisma";
import { addDays, dateOnly } from "~/lib/calendar-day";
import { addTotals, sumByCurrency } from "~/lib/money-totals";
import { DEFAULT_TIME_ZONE, todayInTimeZone } from "~/lib/time-zone";
import { db } from "~/server/db";
import { OPEN_PAYMENT_STATUSES } from "~/server/queries/shared";

/**
 * Aggregates the numbers the Dashboard page renders: net worth (property +
 * investment value, minus loan outstanding), total active-policy coverage,
 * upcoming outflows/inflows due within 30 days, and a short "needs
 * attention" list (overdue, or due within 7 days).
 *
 * Every figure is a `MoneyTotals` — one sum per currency — since amounts
 * in different currencies can't be added; a record without a currency
 * counts in the user's (`currency`).
 */
export async function getDashboardData(
  householdId: string,
  timeZone: string = DEFAULT_TIME_ZONE,
  now: Date = new Date(),
  currency: Currency = "INR",
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
        dueDate: { gte: dateOnly(today) },
      },
      orderBy: { dueDate: "asc" },
      take: 6,
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
    attentionItems,
    upcoming,
  };
}
