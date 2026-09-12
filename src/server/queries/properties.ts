import "server-only";

import { db } from "~/server/db";
import { OPEN_PAYMENT_STATUSES } from "~/server/queries/shared";

/**
 * Properties for the Properties list page, each with its active lease (if
 * any) and every open (unpaid) utility `Bill`, so the card can total up an
 * "Overdue amount" across all of them. `Bill.propertyId` has no back-relation
 * on `Property` for `include`-ing here in one query (see the `Bill` model
 * comment in `schema.prisma`), so open bills are batch-fetched and grouped
 * in application code instead.
 */
export async function getProperties(ownerId: string) {
  const properties = await db.property.findMany({
    where: { ownerId },
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
  return db.property.findFirst({ where: { id: propertyId, ownerId } });
}
