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
 * hard-removed (`deleteLease`, a soft delete via `deletedAt`) if it has no
 * rent `Bill` on record.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { z } from "zod";

import {
  date,
  number,
  optionalDate,
  optionalNumber,
  optionalText,
  parseFormData,
  text,
} from "~/lib/form";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";

/**
 * Loads a property, throwing if it doesn't exist, isn't owned by the
 * signed-in user, or is self-occupied (redirecting to `/` first if there's
 * no session at all).
 */
async function requireRentableProperty(propertyId: string) {
  const session = await getSession();
  if (!session) redirect("/");
  const property = await db.property.findFirst({
    where: { id: propertyId, ownerId: session.user.id },
  });
  if (!property) throw new Error("Property not found");
  if (property.type === "SELF_OCCUPIED") {
    throw new Error("Self-occupied properties can't have leases");
  }
  return { session, property };
}

/**
 * Loads a lease, throwing if it doesn't exist or its property isn't owned
 * by the signed-in user (redirecting to `/` first if there's no session at
 * all). `Lease` has no `ownerId` of its own, so ownership is checked
 * through the `property` relation.
 */
async function requireOwnedLease(leaseId: string, ownerId: string) {
  const lease = await db.lease.findFirst({
    where: { id: leaseId, property: { ownerId } },
  });
  if (!lease) throw new Error("Lease not found");
  return lease;
}

/** The lease terms shared by the "Add lease" and "Change lease" forms. */
const leaseTermsSchema = z.object({
  roomId: optionalText(),
  leaseEnd: optionalDate("Enter a valid lease end date"),
  rentAmount: number("Enter a valid rent amount", { positive: true }),
  depositAmount: number("Enter a valid deposit amount", { min: 0 }),
  // Display-only — day of month (1-31) rent is due; not wired to any
  // `BillSchedule` or generated `Bill`.
  rentDueDay: optionalNumber("Enter a valid rent due day (1-31)", {
    int: true,
    min: 1,
    max: 31,
  }),
});

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
  const { property } = await requireRentableProperty(propertyId);

  if (roomId) {
    const room = await db.room.findFirst({ where: { id: roomId, propertyId } });
    if (!room) throw new Error("Rental unit not found");
  }

  await db.lease.create({
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

  revalidatePath(`/properties/${propertyId}/leases`);
  redirect(`/properties/${propertyId}/leases`);
}

/**
 * Changes an existing lease's terms — rental unit, rent, deposit, lease
 * end — from the "Change lease" form. Doesn't touch `active`; use
 * `endLease` to end the lease itself.
 */
export async function updateLease(leaseId: string, formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/");
  const lease = await requireOwnedLease(leaseId, session.user.id);
  const { roomId, rentAmount, depositAmount, leaseEnd, rentDueDay } =
    parseFormData(leaseTermsSchema, formData);

  if (roomId) {
    const room = await db.room.findFirst({
      where: { id: roomId, propertyId: lease.propertyId },
    });
    if (!room) throw new Error("Rental unit not found");
  }

  await db.lease.update({
    where: { id: leaseId },
    data: { roomId, rentAmount, rentDueDay, depositAmount, leaseEnd },
  });

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
  const session = await getSession();
  if (!session) redirect("/");
  const lease = await requireOwnedLease(leaseId, session.user.id);

  await db.lease.update({
    where: { id: leaseId },
    data: { active: false, leaseEnd: lease.leaseEnd ?? new Date() },
  });

  revalidatePath(`/properties/${lease.propertyId}/leases`);
  redirect(`/properties/${lease.propertyId}/leases`);
}

/**
 * Soft-deletes a lease — refused if any rent `Bill` has ever been
 * generated for it, since that billing history needs the lease record to
 * stay meaningful. Ending the lease (`endLease`) is always available
 * instead; this is for removing a lease added by mistake.
 */
export async function deleteLease(leaseId: string) {
  const session = await getSession();
  if (!session) redirect("/");
  const lease = await requireOwnedLease(leaseId, session.user.id);

  const existingBill = await db.bill.findFirst({
    where: { category: "RENT", leaseId },
    select: { id: true },
  });
  if (existingBill) {
    throw new Error("Cannot delete a lease that has bills on record");
  }

  await db.lease.update({
    where: { id: leaseId },
    data: { deletedAt: new Date() },
  });

  revalidatePath(`/properties/${lease.propertyId}/leases`);
  redirect(`/properties/${lease.propertyId}/leases`);
}
