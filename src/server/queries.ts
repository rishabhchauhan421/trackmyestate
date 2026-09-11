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
 * any) and every open (unpaid) utility `Bill`, so the card can total up an
 * "Overdue amount" across all of them. `Bill.propertyId` has no back-relation
 * on `Property` for `include`-ing here in one query (see the `Bill` model
 * comment in `schema.prisma`), so open bills are batch-fetched and grouped
 * in application code instead.
 */
export async function getProperties(ownerId: string) {
  const properties = await db.property.findMany({
    where: { ownerId },
    include: { tenants: { where: { active: true } } },
    orderBy: { createdAt: "asc" },
  });

  const propertyIds = properties.map((property) => property.id);
  const openBills = propertyIds.length
    ? await db.bill.findMany({
        where: {
          category: "BILL",
          propertyId: { in: propertyIds },
          status: { in: [...OPEN_PAYMENT_STATUSES] },
        },
        orderBy: { dueDate: "asc" },
      })
    : [];

  const openBillsByProperty = new Map<string, typeof openBills>();
  for (const bill of openBills) {
    if (!bill.propertyId) continue;
    const bills = openBillsByProperty.get(bill.propertyId) ?? [];
    bills.push(bill);
    openBillsByProperty.set(bill.propertyId, bills);
  }

  return properties.map((property) => ({
    ...property,
    openBills: openBillsByProperty.get(property.id) ?? [],
  }));
}

/**
 * Policies for the Insurance page, each with its next open premium `Bill`,
 * if any. Batch-fetched and grouped in application code — same rationale as
 * `getProperties`.
 */
export async function getPolicies(ownerId: string) {
  const policies = await db.policy.findMany({
    where: { ownerId },
    orderBy: { createdAt: "asc" },
  });

  const policyIds = policies.map((policy) => policy.id);
  const openPremiums = policyIds.length
    ? await db.bill.findMany({
        where: {
          category: "PREMIUM",
          sourceId: { in: policyIds },
          status: { in: [...OPEN_PAYMENT_STATUSES] },
        },
        orderBy: { dueDate: "asc" },
      })
    : [];

  const nextPremiumByPolicy = new Map<string, (typeof openPremiums)[number]>();
  for (const bill of openPremiums) {
    if (!nextPremiumByPolicy.has(bill.sourceId)) {
      nextPremiumByPolicy.set(bill.sourceId, bill);
    }
  }

  return policies.map((policy) => ({
    ...policy,
    nextPremium: nextPremiumByPolicy.get(policy.id) ?? null,
  }));
}

/** Investments for the Investments page. */
export async function getInvestments(ownerId: string) {
  return db.investment.findMany({
    where: { ownerId },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * A single `Investment`, scoped to `ownerId` — for the edit page. Returns
 * `null` for a nonexistent investment *or* one owned by someone else, same
 * rationale as `getPropertyForOwner`.
 */
export async function getInvestmentForOwner(
  investmentId: string,
  ownerId: string,
) {
  return db.investment.findFirst({ where: { id: investmentId, ownerId } });
}

/**
 * Loans for the Loans page, each with its next open EMI `Bill`, if any.
 * Batch-fetched and grouped in application code — same rationale as
 * `getProperties`.
 */
export async function getLoans(ownerId: string) {
  const loans = await db.loan.findMany({
    where: { ownerId },
    orderBy: { createdAt: "asc" },
  });

  const loanIds = loans.map((loan) => loan.id);
  const openEmis = loanIds.length
    ? await db.bill.findMany({
        where: {
          category: "EMI",
          sourceId: { in: loanIds },
          status: { in: [...OPEN_PAYMENT_STATUSES] },
        },
        orderBy: { dueDate: "asc" },
      })
    : [];

  const nextEmiByLoan = new Map<string, (typeof openEmis)[number]>();
  for (const bill of openEmis) {
    if (!nextEmiByLoan.has(bill.sourceId)) {
      nextEmiByLoan.set(bill.sourceId, bill);
    }
  }

  return loans.map((loan) => ({
    ...loan,
    nextEmi: nextEmiByLoan.get(loan.id) ?? null,
  }));
}

/**
 * A single `Loan`, scoped to `ownerId` — for the edit page. Returns `null`
 * for a nonexistent loan *or* one owned by someone else, same rationale as
 * `getPropertyForOwner`. Its EMI schedule lives on a separate `BillSchedule`
 * row (category `"EMI"`) — see the model comment in `schema.prisma` — so
 * it's fetched and flattened back onto the returned loan under its old
 * field names (`tenureMonths`/`emiAmount`/`emiDueDay`), keeping the edit
 * page's field access unchanged.
 */
export async function getLoanForOwner(loanId: string, ownerId: string) {
  const loan = await db.loan.findFirst({ where: { id: loanId, ownerId } });
  if (!loan) return null;

  const schedule = await db.billSchedule.findFirst({
    where: { category: "EMI", sourceId: loanId },
  });

  // Every Loan gets its EMI BillSchedule created alongside it in
  // createLoan, so this should never actually be null.
  return {
    ...loan,
    tenureMonths: schedule!.tenureMonths!,
    emiAmount: schedule!.defaultAmount!,
    emiDueDay: schedule!.dueDay,
  };
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

/**
 * Every tenant a property has ever had — current and past — newest lease
 * first, for the property detail page. `active` distinguishes the two: a
 * past tenancy is one that's been explicitly ended, not just one whose
 * `leaseEnd` date has passed (there's no lease-expiry job yet). Deleted
 * tenants (see `deleteTenant` in `~/server/actions/tenants`) are excluded —
 * `NOT_SOFT_DELETED` is declared further down this file, but that's fine:
 * this function only reads it once actually called, well after the module
 * has finished evaluating.
 */
export async function getTenantsForProperty(propertyId: string) {
  return db.tenant.findMany({
    where: { propertyId, ...NOT_SOFT_DELETED },
    include: { room: { select: { label: true } } },
    orderBy: { leaseStart: "desc" },
  });
}

/**
 * A single `Tenant`, scoped to the signed-in owner through its property —
 * `Tenant` has no `ownerId` of its own. Returns `null` for a nonexistent
 * tenant *or* one belonging to someone else's property, same rationale as
 * `getPropertyForOwner`. Includes a soft-deleted tenant too (unlike
 * `getTenantsForProperty`'s list), since a direct-by-id lookup like this is
 * only ever used right after a mutation on a tenant the caller already
 * knows the id of.
 */
export async function getTenantForOwner(tenantId: string, ownerId: string) {
  return db.tenant.findFirst({
    where: { id: tenantId, property: { ownerId } },
  });
}

/**
 * Whether any rent `Bill` has ever been generated for this tenant. A
 * tenant with billing history can't be deleted — see `deleteTenant` in
 * `~/server/actions/tenants` — only have its lease ended.
 */
export async function hasBillsForTenant(tenantId: string) {
  const bill = await db.bill.findFirst({
    where: { category: "RENT", sourceId: tenantId },
    select: { id: true },
  });
  return bill != null;
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
 * Rental units (`Room` rows) for a property — the subdivisions of a
 * property that get rented out individually, distinct from a whole-property
 * `Tenant` lease (which leaves `roomId` unset). Only relevant for a
 * non-self-occupied property; callers don't need to check that themselves,
 * since a self-occupied property simply never has any rooms.
 */
export async function getRoomsForProperty(propertyId: string) {
  return db.room.findMany({
    where: { propertyId, ...NOT_SOFT_DELETED },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Active utility `BillSchedule` rows for a property (recurring bill
 * schedules), each with its non-soft-deleted notification recipients.
 * Deactivated utilities are intentionally excluded — see
 * `deactivateUtility` in `~/server/actions/utilities`.
 */
export async function getActiveUtilitiesForProperty(propertyId: string) {
  const schedules = await db.billSchedule.findMany({
    where: { propertyId, category: "BILL", active: true },
    include: {
      recipients: {
        where: NOT_SOFT_DELETED,
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Exposed as `type` (its old field name, back when this was `Utility`),
  // so callers don't need to know about the generic `BillSchedule` shape.
  return schedules.map((schedule) => ({ ...schedule, type: schedule.billType! }));
}

/**
 * `Bill`s for a property, scoped to one category — the generic query
 * primitive behind the (still per-domain) UI pages. `Bill.sourceId` has no
 * declared relation (see the `Bill` model comment in `schema.prisma`), so
 * category-specific enrichment — e.g. utility type/provider — is layered on
 * top by the caller, not here.
 */
export async function getBillsForProperty(
  propertyId: string,
  category: "BILL" | "RENT",
) {
  return db.bill.findMany({
    where: { propertyId, category },
    orderBy: { dueDate: "desc" },
  });
}

/**
 * Every generated utility `Bill` for a property, newest due date first,
 * each with its parent utility `BillSchedule`'s type/provider for display —
 * including bills belonging to a now-deactivated utility, since the bill
 * itself is still a real historical record.
 *
 * Bills are never created directly by an owner — a (not-yet-built)
 * background job generates one per utility on the date of its first
 * notification (see `generateBill` in `~/server/actions/bills`).
 */
export async function getUtilityBillsForProperty(propertyId: string) {
  const bills = await getBillsForProperty(propertyId, "BILL");

  const utilityIds = [...new Set(bills.map((bill) => bill.sourceId))];
  const utilities = utilityIds.length
    ? await db.billSchedule.findMany({
        where: { id: { in: utilityIds } },
        select: { id: true, billType: true, provider: true, active: true },
      })
    : [];
  const utilityById = new Map(
    utilities.map((utility) => [
      utility.id,
      { type: utility.billType!, provider: utility.provider, active: utility.active },
    ]),
  );

  return bills.map((bill) => ({
    ...bill,
    utility: utilityById.get(bill.sourceId)!,
  }));
}

/**
 * A single utility `Bill`, scoped to `ownerId` — for the bill detail/mark-
 * paid page. Returns `null` for a nonexistent bill *or* one belonging to
 * someone else, same rationale as `getPropertyForOwner`. `Bill.ownerId` is
 * denormalized directly onto the row (same convention as
 * `FinancialEvent.ownerId`), so ownership is checked without a join.
 */
export async function getUtilityBillForOwner(
  utilityBillId: string,
  ownerId: string,
) {
  const bill = await db.bill.findFirst({
    where: { id: utilityBillId, category: "BILL", ownerId },
    include: { property: { select: { id: true, name: true } } },
  });
  if (!bill) return null;

  const utility = await db.billSchedule.findFirst({
    where: { id: bill.sourceId },
    select: { billType: true, provider: true },
  });
  if (!utility) return null;

  // A utility Bill always has a propertyId (set at generation time), so its
  // `property` relation is never actually null here.
  return {
    ...bill,
    utility: { type: utility.billType!, provider: utility.provider },
    property: bill.property!,
  };
}
