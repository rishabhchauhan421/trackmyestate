import "server-only";

import { db } from "~/server/db";
import { OPEN_PAYMENT_STATUSES } from "~/server/queries/shared";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Aggregates the numbers the Dashboard page renders: net worth (property +
 * investment value, minus loan outstanding), total active-policy coverage,
 * upcoming outflows/inflows due within 30 days, and a short "needs
 * attention" list (overdue, or due within 7 days).
 */
export async function getDashboardData(ownerId: string) {
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * DAY_MS);
  const in30Days = new Date(now.getTime() + 30 * DAY_MS);

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
        dueDate: { gte: startOfDay(now) },
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

function startOfDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}
