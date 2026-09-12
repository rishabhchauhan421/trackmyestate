import "server-only";

import { db } from "~/server/db";
import { getBillsForProperty } from "~/server/queries/bills";

/**
 * Active utility `BillSchedule` rows for a property (recurring bill
 * schedules), each with its embedded notification recipients. Deactivated
 * utilities are intentionally excluded — see `deactivateUtility` in
 * `~/server/actions/utilities`.
 */
export async function getActiveUtilitiesForProperty(propertyId: string) {
  const schedules = await db.billSchedule.findMany({
    where: { propertyId, category: "UTILITY_BILL", active: true },
    orderBy: { createdAt: "asc" },
  });

  // Exposed as `type` (its old field name, back when this was `Utility`),
  // so callers don't need to know about the generic `BillSchedule` shape.
  return schedules.map((schedule) => ({ ...schedule, type: schedule.billType! }));
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
  const bills = await getBillsForProperty(propertyId, "UTILITY_BILL");

  const utilityIds = [
    ...new Set(bills.map((bill) => bill.billScheduleId!)),
  ];
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
    utility: utilityById.get(bill.billScheduleId!)!,
  }));
}

/**
 * A single utility `Bill`, scoped to `ownerId` — for the bill detail/mark-
 * paid page. Returns `null` for a nonexistent bill *or* one belonging to
 * someone else, same rationale as `getPropertyForOwner`. `Bill.ownerId` is
 * denormalized directly onto the row, so ownership is checked without a
 * join.
 */
export async function getUtilityBillForOwner(
  utilityBillId: string,
  ownerId: string,
) {
  const bill = await db.bill.findFirst({
    where: { id: utilityBillId, category: "UTILITY_BILL", ownerId },
    include: { property: { select: { id: true, name: true } } },
  });
  if (!bill) return null;

  const utility = await db.billSchedule.findFirst({
    where: { id: bill.billScheduleId! },
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
