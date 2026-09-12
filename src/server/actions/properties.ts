"use server";

/**
 * Server Actions for the Properties feature. A `Property` can be edited in
 * full after creation — its current estimated value in particular is meant
 * to be kept up to date by the owner over time, same as `Investment` (see
 * `~/server/actions/investments`). It can only be hard-removed
 * (`deleteProperty`, a soft delete via `deletedAt`) once every leases,
 * rental units, utility schedules, bills and linked loans are gone — see
 * `hasDependentRecordsForProperty` in `~/server/queries/properties`. Every
 * mutation re-checks ownership itself rather than trusting the caller,
 * since these are invoked directly from client forms.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { PropertyType } from "../../../generated/prisma";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { hasDependentRecordsForProperty } from "~/server/queries/properties";
import { NOT_SOFT_DELETED } from "~/server/queries/shared";

async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/");
  return session;
}

async function requireOwnedProperty(propertyId: string, ownerId: string) {
  const property = await db.property.findFirst({
    where: { id: propertyId, ownerId, ...NOT_SOFT_DELETED },
  });
  if (!property) throw new Error("Property not found");
  return property;
}

/** Parses and validates the fields shared by create and update, from the Property form. */
function parsePropertyFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type")) as PropertyType;
  const addressLine1 = String(formData.get("addressLine1") ?? "").trim();
  const addressLine2 =
    String(formData.get("addressLine2") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const pinCode = String(formData.get("pinCode") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim() || "India";
  const purchasePriceRaw = String(formData.get("purchasePrice") ?? "").trim();
  const purchasePrice = purchasePriceRaw ? Number(purchasePriceRaw) : null;
  const currentEstimatedValueRaw = String(
    formData.get("currentEstimatedValue") ?? "",
  ).trim();
  const currentEstimatedValue = currentEstimatedValueRaw
    ? Number(currentEstimatedValueRaw)
    : null;
  const purchaseDateRaw = String(formData.get("purchaseDate") ?? "").trim();
  const purchaseDate = purchaseDateRaw ? new Date(purchaseDateRaw) : null;

  if (!name) throw new Error("Enter a name");
  if (!addressLine1) throw new Error("Enter the address");
  if (!city) throw new Error("Enter the city");
  if (!state) throw new Error("Enter the state");
  if (!pinCode) throw new Error("Enter the PIN code");
  if (purchasePrice != null && !Number.isFinite(purchasePrice)) {
    throw new Error("Enter a valid purchase price");
  }
  if (
    currentEstimatedValue != null &&
    !Number.isFinite(currentEstimatedValue)
  ) {
    throw new Error("Enter a valid current estimated value");
  }
  if (purchaseDate && Number.isNaN(purchaseDate.getTime())) {
    throw new Error("Enter a valid purchase date");
  }

  return {
    name,
    type,
    addressLine1,
    addressLine2,
    city,
    state,
    pinCode,
    country,
    purchasePrice,
    currentEstimatedValue,
    purchaseDate,
  };
}

/** Creates a new `Property` for the signed-in owner. */
export async function createProperty(formData: FormData) {
  const session = await requireSession();
  const fields = parsePropertyFields(formData);

  await db.property.create({
    data: { ownerId: session.user.id, ...fields },
  });

  revalidatePath("/properties");
  redirect("/properties");
}

/** Updates every editable field of an existing `Property` the owner holds. */
export async function updateProperty(propertyId: string, formData: FormData) {
  const session = await requireSession();
  await requireOwnedProperty(propertyId, session.user.id);
  const fields = parsePropertyFields(formData);

  await db.property.update({
    where: { id: propertyId },
    data: fields,
  });

  revalidatePath("/properties");
  revalidatePath(`/properties/${propertyId}`);
  redirect("/properties");
}

/**
 * Soft-deletes a property — refused if it has any leases, rental units,
 * utility schedules, bills, or a linked loan on record, since those all
 * depend on the property record staying meaningful. Same rationale as
 * `deleteLease`.
 */
export async function deleteProperty(propertyId: string) {
  const session = await requireSession();
  await requireOwnedProperty(propertyId, session.user.id);

  if (await hasDependentRecordsForProperty(propertyId)) {
    throw new Error(
      "Cannot delete a property that has leases, rental units, utilities or bills on record",
    );
  }

  await db.property.update({
    where: { id: propertyId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/properties");
  redirect("/properties");
}
