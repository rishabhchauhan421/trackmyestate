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

/**
 * Parses and validates the optional "rent due day" field, shared by create
 * and update. Display-only — day of month (1-31) rent is due; not wired to
 * any `BillSchedule` or generated `Bill`.
 */
function parseRentDueDay(formData: FormData) {
  const raw = String(formData.get("rentDueDay") ?? "").trim();
  if (!raw) return null;
  const rentDueDay = Number(raw);
  if (!Number.isInteger(rentDueDay) || rentDueDay < 1 || rentDueDay > 31) {
    throw new Error("Enter a valid rent due day (1-31)");
  }
  return rentDueDay;
}

/** Creates a new active `Lease` for a property, from the "Add lease" form. */
export async function createLease(formData: FormData) {
  const propertyId = String(formData.get("propertyId"));
  const { property } = await requireRentableProperty(propertyId);

  const roomId = String(formData.get("roomId") ?? "").trim() || null;
  if (roomId) {
    const room = await db.room.findFirst({ where: { id: roomId, propertyId } });
    if (!room) throw new Error("Rental unit not found");
  }

  const tenantName = String(formData.get("tenantName") ?? "").trim();
  const tenantPhone = String(formData.get("tenantPhone") ?? "").trim();
  const tenantEmail = String(formData.get("tenantEmail") ?? "").trim() || null;
  const leaseStart = new Date(String(formData.get("leaseStart")));
  const leaseEndRaw = String(formData.get("leaseEnd") ?? "").trim();
  const leaseEnd = leaseEndRaw ? new Date(leaseEndRaw) : null;
  const rentAmount = Number(formData.get("rentAmount"));
  const depositAmount = Number(formData.get("depositAmount"));
  const rentDueDay = parseRentDueDay(formData);

  if (!tenantName) throw new Error("Enter the tenant's name");
  if (!tenantPhone) throw new Error("Enter the tenant's phone number");
  if (Number.isNaN(leaseStart.getTime())) {
    throw new Error("Enter a valid lease start date");
  }
  if (leaseEnd && Number.isNaN(leaseEnd.getTime())) {
    throw new Error("Enter a valid lease end date");
  }
  if (!Number.isFinite(rentAmount) || rentAmount <= 0) {
    throw new Error("Enter a valid rent amount");
  }
  if (!Number.isFinite(depositAmount) || depositAmount < 0) {
    throw new Error("Enter a valid deposit amount");
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

  const roomId = String(formData.get("roomId") ?? "").trim() || null;
  if (roomId) {
    const room = await db.room.findFirst({
      where: { id: roomId, propertyId: lease.propertyId },
    });
    if (!room) throw new Error("Rental unit not found");
  }

  const rentAmount = Number(formData.get("rentAmount"));
  const depositAmount = Number(formData.get("depositAmount"));
  const leaseEndRaw = String(formData.get("leaseEnd") ?? "").trim();
  const leaseEnd = leaseEndRaw ? new Date(leaseEndRaw) : null;
  const rentDueDay = parseRentDueDay(formData);

  if (!Number.isFinite(rentAmount) || rentAmount <= 0) {
    throw new Error("Enter a valid rent amount");
  }
  if (!Number.isFinite(depositAmount) || depositAmount < 0) {
    throw new Error("Enter a valid deposit amount");
  }
  if (leaseEnd && Number.isNaN(leaseEnd.getTime())) {
    throw new Error("Enter a valid lease end date");
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
