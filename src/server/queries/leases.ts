import "server-only";

import { db } from "~/server/db";
import { hasPaymentHistory } from "~/server/schedules/lifecycle";
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
 * A single `Lease`, scoped to a household through its property — `Lease`
 * has no `householdId` of its own. Returns `null` for a nonexistent or
 * deleted lease, or one on another household's property, same rationale as
 * `getPropertyForHousehold`.
 */
export async function getLeaseForHousehold(
  leaseId: string,
  householdId: string,
) {
  return db.lease.findFirst({
    where: { id: leaseId, property: { householdId } },
  });
}

/**
 * Whether money has been recorded against any of this lease's bills
 * (rent). Such a lease can't be deleted — see `deleteLease` in
 * `~/server/actions/leases` — because that history needs it; unpaid bills
 * are removed along with it instead.
 */
export async function hasPaymentsForLease(leaseId: string) {
  return hasPaymentHistory(db, { leaseId: leaseId });
}
