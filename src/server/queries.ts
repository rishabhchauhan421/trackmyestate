/**
 * Read-only data access for Server Components. Every function here is
 * scoped to a specific `ownerId` (or a property already verified to belong
 * to one) — callers are responsible for getting that id from a real session
 * via `~/server/better-auth/server`, never from client input directly.
 *
 * `import "server-only"` below makes accidentally importing this module
 * from a Client Component a build-time error rather than a leaked query.
 */
import "server-only";

import { db } from "~/server/db";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Payment/bill statuses that still represent money owed (not yet settled). */
const OPEN_PAYMENT_STATUSES = ["DUE", "OVERDUE", "PARTIALLY_PAID"] as const;

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
    db.financialEvent.aggregate({
      where: {
        ownerId,
        type: "OUTFLOW",
        status: { in: [...OPEN_PAYMENT_STATUSES] },
        dueDate: { lte: in30Days },
      },
      _sum: { amount: true },
    }),
    db.financialEvent.aggregate({
      where: {
        ownerId,
        type: "INFLOW",
        status: { in: [...OPEN_PAYMENT_STATUSES] },
        dueDate: { lte: in30Days },
      },
      _sum: { amount: true },
    }),
    db.financialEvent.findMany({
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
  ]);

  const netWorth =
    (propertyValue._sum.currentEstimatedValue ?? 0) +
    (investmentValue._sum.currentEstimatedValue ?? 0) -
    (loanOutstanding._sum.outstandingBalance ?? 0);

  return {
    netWorth,
    totalCoverage: coverage._sum.sumAssured ?? 0,
    upcomingOutflows: outflows._sum.amount ?? 0,
    expectedInflows: inflows._sum.amount ?? 0,
    attentionItems,
  };
}

export type TimelineRange = "month" | "quarter" | "year";
export type TimelineFilter = "all" | "inflow" | "outflow";

/**
 * Computes the `[start, end)` window for a timeline range, anchored to the
 * current calendar month/quarter/year. Quarter/year bounds intentionally
 * pass a month index of 12+ to `Date`'s constructor when the period crosses
 * a year boundary (e.g. Q4 -> month 12) — `Date` normalizes that into
 * January of the following year, which is the desired result.
 */
function rangeBounds(range: TimelineRange): { start: Date; end: Date } {
  const now = new Date();
  if (range === "year") {
    return {
      start: new Date(now.getFullYear(), 0, 1),
      end: new Date(now.getFullYear() + 1, 0, 1),
    };
  }
  if (range === "quarter") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return {
      start: new Date(now.getFullYear(), quarterStartMonth, 1),
      end: new Date(now.getFullYear(), quarterStartMonth + 3, 1),
    };
  }
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

/**
 * Financial events for the Timeline page, bounded to the given calendar
 * range and optionally filtered to only inflows or only outflows.
 */
export async function getTimelineEvents(
  ownerId: string,
  range: TimelineRange,
  filter: TimelineFilter,
) {
  const { start, end } = rangeBounds(range);
  return db.financialEvent.findMany({
    where: {
      ownerId,
      dueDate: { gte: start, lt: end },
      ...(filter === "inflow" && { type: "INFLOW" }),
      ...(filter === "outflow" && { type: "OUTFLOW" }),
    },
    orderBy: { dueDate: "asc" },
  });
}

/**
 * Properties for the Properties list page, each with its active tenant (if
 * any) and next open (unpaid) utility bill, if any.
 */
export async function getProperties(ownerId: string) {
  return db.property.findMany({
    where: { ownerId },
    include: {
      tenants: { where: { active: true } },
      utilityBills: {
        where: { status: { in: [...OPEN_PAYMENT_STATUSES] } },
        orderBy: { dueDate: "asc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/** Policies for the Insurance page, each with its next open premium payment, if any. */
export async function getPolicies(ownerId: string) {
  return db.policy.findMany({
    where: { ownerId },
    include: {
      premiumPayments: {
        where: { status: { in: [...OPEN_PAYMENT_STATUSES] } },
        orderBy: { dueDate: "asc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/** Investments for the Investments & Loans page. */
export async function getInvestments(ownerId: string) {
  return db.investment.findMany({
    where: { ownerId },
    orderBy: { createdAt: "asc" },
  });
}

/** Loans for the Investments & Loans page, each with its next open EMI, if any. */
export async function getLoans(ownerId: string) {
  return db.loan.findMany({
    where: { ownerId },
    include: {
      emiPayments: {
        where: { status: { in: [...OPEN_PAYMENT_STATUSES] } },
        orderBy: { dueDate: "asc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/** Documents for the Documents page (there's no upload flow yet, so usually empty). */
export async function getDocuments(ownerId: string) {
  return db.document.findMany({
    where: { ownerId },
    orderBy: { uploadedAt: "desc" },
  });
}

/**
 * Looks up a property by id, scoped to `ownerId`. Returns `null` for a
 * nonexistent property *or* one owned by someone else — callers should
 * treat both the same way (404), not distinguish them, to avoid leaking
 * which property ids exist.
 */
export async function getPropertyForOwner(propertyId: string, ownerId: string) {
  return db.property.findFirst({ where: { id: propertyId, ownerId } });
}

// Records created before `deletedAt` existed on a model (or created without
// explicitly setting it) simply lack the key in MongoDB rather than storing
// it as null — a plain `{ deletedAt: null }` filter only matches documents
// where the key is explicitly null, so it silently excludes those. `isSet`
// catches the "key absent" case too.
const NOT_SOFT_DELETED = {
  OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
};

/**
 * Active `Utility` templates for a property (recurring bill schedules),
 * each with its non-soft-deleted notification recipients. Deactivated
 * utilities are intentionally excluded — see `deactivateUtility` in
 * `~/server/actions/utilities`.
 */
export async function getActiveUtilitiesForProperty(propertyId: string) {
  return db.utility.findMany({
    where: { propertyId, active: true },
    include: {
      recipients: {
        where: NOT_SOFT_DELETED,
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Every generated `UtilityBill` for a property, newest due date first —
 * including bills belonging to a now-deactivated utility, since the bill
 * itself is still a real historical record.
 *
 * Bills are never created directly by an owner — a (not-yet-built)
 * background job generates one per utility on the date of its first
 * notification (see `generateUtilityBill` in `~/server/actions/utilities`).
 */
export async function getUtilityBillsForProperty(propertyId: string) {
  return db.utilityBill.findMany({
    where: { propertyId },
    include: {
      utility: { select: { type: true, provider: true, active: true } },
    },
    orderBy: { dueDate: "desc" },
  });
}
