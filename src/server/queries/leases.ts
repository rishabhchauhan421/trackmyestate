import "server-only";

import { db } from "~/server/db";
import { NOT_SOFT_DELETED } from "~/server/queries/shared";

/**
 * Every lease a property has ever had — current and past — newest first,
 * for the property detail page. `active` distinguishes the two: a past
 * lease is one that's been explicitly ended, not just one whose `leaseEnd`
 * date has passed (there's no lease-expiry job yet). Deleted leases (see
 * `deleteLease` in `~/server/actions/leases`) are excluded.
 */
export async function getLeasesForProperty(propertyId: string) {
  return db.lease.findMany({
    where: { propertyId, ...NOT_SOFT_DELETED },
    include: { room: { select: { label: true } } },
    orderBy: { leaseStart: "desc" },
  });
}

/**
 * A single `Lease`, scoped to the signed-in owner through its property —
 * `Lease` has no `ownerId` of its own. Returns `null` for a nonexistent
 * lease *or* one belonging to someone else's property, same rationale as
 * `getPropertyForOwner`. Includes a soft-deleted lease too (unlike
 * `getLeasesForProperty`'s list), since a direct-by-id lookup like this is
 * only ever used right after a mutation on a lease the caller already
 * knows the id of.
 */
export async function getLeaseForOwner(leaseId: string, ownerId: string) {
  return db.lease.findFirst({
    where: { id: leaseId, property: { ownerId } },
  });
}

/**
 * Whether any rent `Bill` has ever been generated for this lease. A lease
 * with billing history can't be deleted — see `deleteLease` in
 * `~/server/actions/leases` — only have its lease ended.
 */
export async function hasBillsForLease(leaseId: string) {
  const bill = await db.bill.findFirst({
    where: { category: "RENT", leaseId },
    select: { id: true },
  });
  return bill != null;
}
