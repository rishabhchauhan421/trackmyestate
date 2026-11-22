import "server-only";

import { db } from "~/server/db";
import {
  NOT_SOFT_DELETED,
  OPEN_PAYMENT_STATUSES,
} from "~/server/queries/shared";

const OPEN: readonly string[] = OPEN_PAYMENT_STATUSES;

/** What's still owed across `bills`, in minor units. */
function owedOn(
  bills: { amount: number; paidAmount: number | null; status: string }[],
) {
  return bills
    .filter((bill) => OPEN.includes(bill.status))
    .reduce(
      (sum, bill) =>
        sum +
        Math.max(
          bill.amount -
            (bill.status === "PARTIALLY_PAID" ? (bill.paidAmount ?? 0) : 0),
          0,
        ),
      0,
    );
}

/**
 * A property's issues, open ones first then newest, each with what's still
 * owed under it and its next unpaid due. Deleted issues are excluded (see
 * `~/server/soft-delete`).
 */
export async function getIssuesForProperty(propertyId: string) {
  const issues = await db.propertyIssue.findMany({
    where: { propertyId },
    include: {
      bills: {
        where: {
          status: { in: [...OPEN_PAYMENT_STATUSES] },
          ...NOT_SOFT_DELETED,
        },
        orderBy: { dueDate: "asc" },
      },
    },
    orderBy: { openedOn: "desc" },
  });
  return issues
    .map((issue) => ({
      ...issue,
      owed: owedOn(issue.bills),
      nextDue: issue.bills[0] ?? null,
    }))
    .sort((a, b) => Number(b.status === "OPEN") - Number(a.status === "OPEN"));
}

/**
 * One issue with its property and every due under it, scoped to a
 * household. Null for an issue that doesn't exist, was deleted, or belongs
 * to another household (callers 404 on all three alike).
 */
export async function getIssueForHousehold(
  issueId: string,
  householdId: string,
) {
  const issue = await db.propertyIssue.findFirst({
    where: { id: issueId, householdId },
    include: {
      property: {
        select: {
          id: true,
          name: true,
          currency: true,
          ownershipType: true,
          deletedAt: true,
        },
      },
      // Nested reads aren't soft-delete filtered (see `~/server/db`).
      bills: { where: NOT_SOFT_DELETED, orderBy: { dueDate: "asc" } },
    },
  });
  if (!issue || issue.property.deletedAt) return null;
  return { ...issue, owed: owedOn(issue.bills) };
}

/** How many open issues each of `propertyIds` has (absent = none). */
export async function countOpenIssuesByProperty(propertyIds: string[]) {
  if (propertyIds.length === 0) return new Map<string, number>();
  const issues = await db.propertyIssue.findMany({
    where: { propertyId: { in: propertyIds }, status: "OPEN" },
    select: { propertyId: true },
  });
  const counts = new Map<string, number>();
  for (const issue of issues) {
    counts.set(issue.propertyId, (counts.get(issue.propertyId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Every open issue in the household with its property's name and unpaid
 * dues, for the dashboard's "Needs attention" card.
 */
export async function getOpenIssuesForHousehold(householdId: string) {
  const issues = await db.propertyIssue.findMany({
    where: { householdId, status: "OPEN" },
    include: {
      property: {
        select: { id: true, name: true, currency: true, deletedAt: true },
      },
      bills: {
        where: {
          status: { in: [...OPEN_PAYMENT_STATUSES] },
          ...NOT_SOFT_DELETED,
        },
        orderBy: { dueDate: "asc" },
      },
    },
    orderBy: { openedOn: "asc" },
  });
  return issues
    .filter((issue) => !issue.property.deletedAt)
    .map((issue) => ({
      ...issue,
      owed: owedOn(issue.bills),
      nextDue: issue.bills[0] ?? null,
    }));
}

/**
 * A property's dues that aren't under any issue (added straight from the
 * property page), soonest first.
 */
export async function getStandaloneDuesForProperty(propertyId: string) {
  return db.bill.findMany({
    where: {
      propertyId,
      category: "PROPERTY_DUE",
      OR: [{ propertyIssueId: null }, { propertyIssueId: { isSet: false } }],
    },
    orderBy: { dueDate: "asc" },
  });
}
