"use server";

/**
 * Server Actions for a property's tenants — a lease, either for the whole
 * property (`roomId` unset) or for one of its rental units (see
 * `~/server/actions/rentals`). A self-occupied property can't be rented
 * out at all, so `createTenant` re-checks that itself the same as
 * ownership — the "Add tenant" UI is disabled for that case, but a direct
 * form submission must be refused too. Once a lease exists, its terms can
 * be changed (`updateTenant`) or the lease ended (`endLease`, which just
 * marks it inactive — the tenant record itself is kept for history). A
 * tenant can only be hard-removed (`deleteTenant`, a soft delete via
 * `deletedAt`) if it has no rent `Bill` on record.
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
    throw new Error("Self-occupied properties can't have tenants");
  }
  return { session, property };
}

/**
 * Loads a tenant, throwing if it doesn't exist or its property isn't
 * owned by the signed-in user (redirecting to `/` first if there's no
 * session at all). `Tenant` has no `ownerId` of its own, so ownership is
 * checked through the `property` relation.
 */
async function requireOwnedTenant(tenantId: string, ownerId: string) {
  const tenant = await db.tenant.findFirst({
    where: { id: tenantId, property: { ownerId } },
  });
  if (!tenant) throw new Error("Tenant not found");
  return tenant;
}

/** Creates a new active `Tenant` lease for a property, from the "Add tenant" form. */
export async function createTenant(formData: FormData) {
  const propertyId = String(formData.get("propertyId"));
  const { property } = await requireRentableProperty(propertyId);

  const roomId = String(formData.get("roomId") ?? "").trim() || null;
  if (roomId) {
    const room = await db.room.findFirst({ where: { id: roomId, propertyId } });
    if (!room) throw new Error("Rental unit not found");
  }

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const leaseStart = new Date(String(formData.get("leaseStart")));
  const leaseEndRaw = String(formData.get("leaseEnd") ?? "").trim();
  const leaseEnd = leaseEndRaw ? new Date(leaseEndRaw) : null;
  const rentAmount = Number(formData.get("rentAmount"));
  const depositAmount = Number(formData.get("depositAmount"));

  if (!name) throw new Error("Enter the tenant's name");
  if (!phone) throw new Error("Enter the tenant's phone number");
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

  await db.tenant.create({
    data: {
      propertyId,
      roomId,
      name,
      phone,
      email,
      leaseStart,
      leaseEnd,
      rentAmount,
      depositAmount,
      currency: property.currency,
      active: true,
    },
  });

  revalidatePath(`/properties/${propertyId}`);
  redirect(`/properties/${propertyId}`);
}

/**
 * Changes an existing tenant's lease terms — rental unit, rent, deposit,
 * lease end — from the "Change lease" form. Doesn't touch `active`; use
 * `endLease` to end the tenancy itself.
 */
export async function updateTenant(tenantId: string, formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/");
  const tenant = await requireOwnedTenant(tenantId, session.user.id);

  const roomId = String(formData.get("roomId") ?? "").trim() || null;
  if (roomId) {
    const room = await db.room.findFirst({
      where: { id: roomId, propertyId: tenant.propertyId },
    });
    if (!room) throw new Error("Rental unit not found");
  }

  const rentAmount = Number(formData.get("rentAmount"));
  const depositAmount = Number(formData.get("depositAmount"));
  const leaseEndRaw = String(formData.get("leaseEnd") ?? "").trim();
  const leaseEnd = leaseEndRaw ? new Date(leaseEndRaw) : null;

  if (!Number.isFinite(rentAmount) || rentAmount <= 0) {
    throw new Error("Enter a valid rent amount");
  }
  if (!Number.isFinite(depositAmount) || depositAmount < 0) {
    throw new Error("Enter a valid deposit amount");
  }
  if (leaseEnd && Number.isNaN(leaseEnd.getTime())) {
    throw new Error("Enter a valid lease end date");
  }

  await db.tenant.update({
    where: { id: tenantId },
    data: { roomId, rentAmount, depositAmount, leaseEnd },
  });

  revalidatePath(`/properties/${tenant.propertyId}`);
  redirect(`/properties/${tenant.propertyId}`);
}

/**
 * Ends a tenancy: marks it inactive and, if `leaseEnd` isn't already set,
 * backfills it to today. The tenant record itself is kept — this is not a
 * delete, just the same "no active tenant" state `getTenantsForProperty`'s
 * callers already treat a past tenancy as.
 */
export async function endLease(tenantId: string) {
  const session = await getSession();
  if (!session) redirect("/");
  const tenant = await requireOwnedTenant(tenantId, session.user.id);

  await db.tenant.update({
    where: { id: tenantId },
    data: { active: false, leaseEnd: tenant.leaseEnd ?? new Date() },
  });

  revalidatePath(`/properties/${tenant.propertyId}`);
  redirect(`/properties/${tenant.propertyId}`);
}

/**
 * Soft-deletes a tenant — refused if any rent `Bill` has ever been
 * generated for it, since that billing history needs the tenant record to
 * stay meaningful. Ending the lease (`endLease`) is always available
 * instead; this is for removing a tenant added by mistake.
 */
export async function deleteTenant(tenantId: string) {
  const session = await getSession();
  if (!session) redirect("/");
  const tenant = await requireOwnedTenant(tenantId, session.user.id);

  const existingBill = await db.bill.findFirst({
    where: { category: "RENT", sourceId: tenantId },
    select: { id: true },
  });
  if (existingBill) {
    throw new Error("Cannot delete a tenant that has bills on record");
  }

  await db.tenant.update({
    where: { id: tenantId },
    data: { deletedAt: new Date() },
  });

  revalidatePath(`/properties/${tenant.propertyId}`);
  redirect(`/properties/${tenant.propertyId}`);
}
