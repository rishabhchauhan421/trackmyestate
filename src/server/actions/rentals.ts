"use server";

/**
 * Server Actions for a property's rental units (`Room` rows) — the
 * subdivisions of a property that get rented out individually, distinct
 * from a whole-property `Lease` (see `~/server/actions/leases`).
 * A self-occupied property can't have rental units at all, so every
 * mutation here re-checks that itself, the same as ownership — the "Add
 * rental unit" UI is disabled for that case, but a direct form submission
 * must be refused too.
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
    throw new Error("Self-occupied properties can't have rental units");
  }
  return { session, property };
}

/** Creates a new rental unit (`Room`) for a property, from the "Add rental unit" form. */
export async function createRental(formData: FormData) {
  const propertyId = String(formData.get("propertyId"));
  await requireRentableProperty(propertyId);

  const label = String(formData.get("label") ?? "").trim();
  const floor = String(formData.get("floor") ?? "").trim() || null;
  const areaSqftRaw = String(formData.get("areaSqft") ?? "").trim();
  const areaSqft = areaSqftRaw ? Number(areaSqftRaw) : null;

  if (!label) throw new Error("Enter a label for this rental unit");
  if (areaSqft != null && (!Number.isFinite(areaSqft) || areaSqft <= 0)) {
    throw new Error("Enter a valid area");
  }

  await db.room.create({
    data: {
      propertyId,
      label,
      floor,
      areaSqft,
    },
  });

  revalidatePath(`/properties/${propertyId}/rentals`);
  redirect(`/properties/${propertyId}/rentals`);
}
