import "server-only";

import { db } from "~/server/db";
import { NOT_SOFT_DELETED, OPEN_PAYMENT_STATUSES } from "~/server/queries/shared";

/**
 * Properties for the Properties list page, each with its active lease (if
 * any) and every open (unpaid) utility `Bill`, so the card can total up an
 * "Overdue amount" across all of them. `Bill.propertyId` has no back-relation
 * on `Property` for `include`-ing here in one query (see the `Bill` model
 * comment in `schema.prisma`), so open bills are batch-fetched and grouped
 * in application code instead. Deleted properties (see `deleteProperty` in
 * `~/server/actions/properties`) are excluded.
 */
export async function getProperties(ownerId: string) {
  const properties = await db.property.findMany({
    where: { ownerId, ...NOT_SOFT_DELETED },
    include: { leases: { where: { active: true } } },
    orderBy: { createdAt: "asc" },
  });

  const propertyIds = properties.map((property) => property.id);
  const openBills = propertyIds.length
    ? await db.bill.findMany({
        where: {
          category: "UTILITY_BILL",
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
 * Looks up a property by id, scoped to `ownerId`. Returns `null` for a
 * nonexistent property *or* one owned by someone else — callers should
 * treat both the same way (404), not distinguish them, to avoid leaking
 * which property ids exist.
 */
export async function getPropertyForOwner(propertyId: string, ownerId: string) {
  return db.property.findFirst({
    where: { id: propertyId, ownerId, ...NOT_SOFT_DELETED },
  });
}

/**
 * Id/name pairs for every one of the owner's properties, for a "link to
 * property" select — e.g. the Loan form's optional `linkedPropertyId`.
 */
export async function getPropertyOptionsForOwner(ownerId: string) {
  return db.property.findMany({
    where: { ownerId, ...NOT_SOFT_DELETED },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Whether a property has any real history hanging off it — bills, leases,
 * rental units, utility schedules, or a loan linked to it — that a
 * `deleteProperty` (see `~/server/actions/properties`) would otherwise
 * orphan. Mirrors `hasBillsForLease`'s rationale in `~/server/queries/leases`.
 */
export async function hasDependentRecordsForProperty(propertyId: string) {
  const [bill, lease, room, billSchedule, loan] = await Promise.all([
    db.bill.findFirst({ where: { propertyId }, select: { id: true } }),
    db.lease.findFirst({
      where: { propertyId, ...NOT_SOFT_DELETED },
      select: { id: true },
    }),
    db.room.findFirst({
      where: { propertyId, ...NOT_SOFT_DELETED },
      select: { id: true },
    }),
    db.billSchedule.findFirst({
      where: { propertyId, ...NOT_SOFT_DELETED },
      select: { id: true },
    }),
    db.loan.findFirst({
      where: { linkedPropertyId: propertyId, ...NOT_SOFT_DELETED },
      select: { id: true },
    }),
  ]);
  return Boolean(bill ?? lease ?? room ?? billSchedule ?? loan);
}
