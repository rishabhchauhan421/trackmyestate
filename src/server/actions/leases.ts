"use server";

/**
 * Server Actions for a property's leases — a rental agreement, either for
 * the whole property (`roomId` unset) or for one of its rental units (see
 * `~/server/actions/rentals`), with the tenant's identity details living on
 * the lease itself (`tenantName`/`tenantPhone`/`tenantEmail`) rather than a
 * separate Tenant record. A self-occupied property can't be rented out at
 * all, so `createLease` re-checks that itself the same as ownership — the
 * "Add lease" UI is disabled for that case, but a direct form submission
 * must be refused too. Once a lease exists, its terms can be changed
 * (`updateLease`) or the lease ended (`endLease`, which just marks it
 * inactive — the record itself is kept for history). A lease can only be
 * hard-removed (`deleteLease`, a soft delete via `deletedAt`) until rent
 * has been received against it.
 *
 * Every lease has a monthly RENT `BillSchedule` (incoming money), kept in
 * step through `~/server/schedules/lifecycle`: created with the lease,
 * updated with its terms, stopped when it ends and removed with it.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { z } from "zod";

import { addDays, calendarDayOf, dateOnly } from "~/lib/calendar-day";
import {
  date,
  FormError,
  money,
  number,
  optionalDate,
  optionalText,
  parseFormData,
  text,
} from "~/lib/form";
import { firstDueDayAfter } from "~/lib/schedule";
import { generateBillsForSchedule } from "~/server/bills/generate";
import { db } from "~/server/db";
import { toFormState, type FormState } from "~/server/form-state";
import { requireScope } from "~/server/households";
import {
  hasPaymentHistory,
  retireSchedules,
  saveSchedule,
  todayFor,
  type ScheduleTerms,
} from "~/server/schedules/lifecycle";

/**
 * Loads a property, throwing if it doesn't exist, isn't owned by the
 * signed-in user, or is self-occupied (redirecting to `/` first if there's
 * no session at all).
 */
async function requireRentableProperty(propertyId: string) {
  const scope = await requireScope();
  const property = await db.property.findFirst({
    where: { id: propertyId, householdId: scope.householdId },
  });
  if (!property) throw new FormError("Property not found");
  if (property.type === "SELF_OCCUPIED") {
    throw new FormError("Self-occupied properties can't have leases");
  }
  return { scope, property };
}

/**
 * Loads a lease, throwing if it doesn't exist or its property isn't owned
 * by the signed-in user (redirecting to `/` first if there's no session at
 * all). `Lease` has no `ownerId` of its own, so ownership is checked
 * through the `property` relation.
 */
async function requireOwnedLease(leaseId: string, householdId: string) {
  const lease = await db.lease.findFirst({
    where: { id: leaseId, property: { householdId } },
  });
  if (!lease) throw new FormError("Lease not found");
  return lease;
}

/** The lease terms shared by the "Add lease" and "Change lease" forms. */
const leaseTermsSchema = z.object({
  roomId: optionalText(),
  leaseEnd: optionalDate("Enter a valid lease end date"),
  rentAmount: money("Enter a valid rent amount", { positive: true }),
  depositAmount: money("Enter a valid deposit amount", { min: 0 }),
  // Day of the month (1-31) rent is due: drives the lease's rent bills.
  rentDueDay: number(
    "Enter a valid rent due day (1-31)",
    { int: true, min: 1, max: 31 },
    "Enter the day of the month rent is due",
  ),
});

/**
 * The lease's rent schedule: monthly on `rentDueDay`, from the first such
 * day on or after the lease starts, until it ends.
 */
function rentTerms(lease: {
  leaseStart: Date;
  leaseEnd: Date | null;
  rentDueDay: number;
  rentAmount: number;
}): ScheduleTerms {
  const dayBeforeStart = addDays(calendarDayOf(lease.leaseStart), -1);
  return {
    recurrence: "MONTHLY",
    startDate: dateOnly(firstDueDayAfter(dayBeforeStart, lease.rentDueDay)),
    dueDay: lease.rentDueDay,
    endDate: lease.leaseEnd,
    defaultAmount: lease.rentAmount,
  };
}

/** A lease can't end before it starts (it may end the day it starts). */
function requireEndAfterStart(leaseStart: Date, leaseEnd: Date | null) {
  if (leaseEnd && leaseEnd < leaseStart) {
    throw new FormError("The lease can't end before it starts", "leaseEnd");
  }
}

/** The "Add lease" form: the terms plus who the tenant is. */
const createLeaseSchema = leaseTermsSchema.extend({
  propertyId: text("Property not found"),
  tenantName: text("Enter the tenant's name"),
  tenantPhone: text("Enter the tenant's phone number"),
  tenantEmail: optionalText(),
  leaseStart: date("Enter a valid lease start date"),
});

/** Creates a new active `Lease` for a property, from the "Add lease" form. */
export async function createLease(formData: FormData) {
  const {
    propertyId,
    roomId,
    tenantName,
    tenantPhone,
    tenantEmail,
    leaseStart,
    leaseEnd,
    rentAmount,
    depositAmount,
    rentDueDay,
  } = parseFormData(createLeaseSchema, formData);
  requireEndAfterStart(leaseStart, leaseEnd);
  const { scope, property } = await requireRentableProperty(propertyId);

  if (roomId) {
    const room = await db.room.findFirst({ where: { id: roomId, propertyId } });
    if (!room) throw new FormError("Rental unit not found");
  }

  const today = await todayFor(scope.userId);
  const scheduleId = await db.$transaction(async (tx) => {
    const lease = await tx.lease.create({
      data: {
        propertyId,
        roomId,
        tenantName,
        tenantPhone,
        tenantEmail,
        leaseStart,
        leaseEnd,
        rentAmount,
        rentDueDay,
        depositAmount,
        currency: property.currency,
        active: true,
      },
    });
    return saveSchedule(tx, {
      owner: { leaseId: lease.id },
      category: "RENT",
      data: {
        ownerId: scope.userId,
        householdId: scope.householdId,
        propertyId,
        leaseId: lease.id,
      },
      terms: rentTerms({ leaseStart, leaseEnd, rentDueDay, rentAmount }),
      today,
    });
  });
  // Create its first rent bills now, so the next one shows up straight away.
  await generateBillsForSchedule(scheduleId);

  revalidatePath(`/properties/${propertyId}/leases`);
  redirect(`/properties/${propertyId}/leases`);
}

/**
 * Changes an existing lease's terms — rental unit, rent, deposit, lease
 * end — from the "Change lease" form. Doesn't touch `active`; use
 * `endLease` to end the lease itself.
 */
export async function updateLease(leaseId: string, formData: FormData) {
  const scope = await requireScope();
  const lease = await requireOwnedLease(leaseId, scope.householdId);
  const { roomId, rentAmount, depositAmount, leaseEnd, rentDueDay } =
    parseFormData(leaseTermsSchema, formData);
  requireEndAfterStart(lease.leaseStart, leaseEnd);

  if (roomId) {
    const room = await db.room.findFirst({
      where: { id: roomId, propertyId: lease.propertyId },
    });
    if (!room) throw new FormError("Rental unit not found");
  }

  const today = await todayFor(scope.userId);
  const scheduleId = await db.$transaction(async (tx) => {
    await tx.lease.update({
      where: { id: leaseId },
      data: { roomId, rentAmount, rentDueDay, depositAmount, leaseEnd },
    });
    if (!lease.active) return null;
    // New rent, due day or end date replaces the upcoming unpaid rent.
    return saveSchedule(tx, {
      owner: { leaseId },
      category: "RENT",
      data: {
        ownerId: scope.userId,
        householdId: scope.householdId,
        propertyId: lease.propertyId,
        leaseId,
      },
      terms: rentTerms({
        leaseStart: lease.leaseStart,
        leaseEnd,
        rentDueDay,
        rentAmount,
      }),
      today,
    });
  });
  if (scheduleId) await generateBillsForSchedule(scheduleId);

  revalidatePath(`/properties/${lease.propertyId}/leases`);
  redirect(`/properties/${lease.propertyId}/leases`);
}

/**
 * Ends a lease: marks it inactive and, if `leaseEnd` isn't already set,
 * backfills it to today. The record itself is kept — this is not a
 * delete, just the same "no active lease" state `getLeasesForProperty`'s
 * callers already treat a past lease as.
 */
export async function endLease(leaseId: string) {
  const scope = await requireScope();
  const lease = await requireOwnedLease(leaseId, scope.householdId);

  const today = await todayFor(scope.userId);
  const leaseEnd = lease.leaseEnd ?? today;
  await db.$transaction(async (tx) => {
    await tx.lease.update({
      where: { id: leaseId },
      data: { active: false, leaseEnd },
    });
    // No rent after the lease's last day; rent still owed before it stays.
    await retireSchedules(
      tx,
      { leaseId, category: "RENT" },
      { from: dateOnly(addDays(calendarDayOf(leaseEnd), 1)) },
    );
  });

  revalidatePath(`/properties/${lease.propertyId}/leases`);
  redirect(`/properties/${lease.propertyId}/leases`);
}

/**
 * Soft-deletes a lease, its rent schedule and its unpaid rent bills —
 * refused once rent has been received against it, since that history
 * needs the lease record to stay meaningful. Ending the lease (`endLease`) is always available
 * instead; this is for removing a lease added by mistake.
 */
export async function deleteLease(leaseId: string) {
  const scope = await requireScope();
  const lease = await requireOwnedLease(leaseId, scope.householdId);

  if (await hasPaymentHistory(db, { leaseId })) {
    throw new FormError(
      "Cannot delete a lease that has rent received on record",
    );
  }

  const today = await todayFor(scope.userId);
  await db.$transaction(async (tx) => {
    // Also mark it inactive: a deleted lease must never count as the
    // property's or rental unit's current tenancy.
    await tx.lease.update({
      where: { id: leaseId },
      data: { active: false, deletedAt: new Date() },
    });
    await retireSchedules(tx, { leaseId }, { from: today, remove: true });
  });

  revalidatePath(`/properties/${lease.propertyId}/leases`);
  redirect(`/properties/${lease.propertyId}/leases`);
}

// Form twins for `ActionForm` (see `~/server/form-state`).

export async function createLeaseForm(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  return toFormState(() => createLease(formData));
}

export async function updateLeaseForm(
  leaseId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  return toFormState(() => updateLease(leaseId, formData));
}

export async function endLeaseForm(
  leaseId: string,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  return toFormState(() => endLease(leaseId));
}

export async function deleteLeaseForm(
  leaseId: string,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  return toFormState(() => deleteLease(leaseId));
}
