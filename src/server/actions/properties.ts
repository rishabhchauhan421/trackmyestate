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

import { z } from "zod";

import {
  OwnershipType,
  PropertyCategory,
  PropertyType,
} from "../../../generated/prisma";
import {
  enumValue,
  optionalDate,
  optionalEnumValue,
  optionalNumber,
  optionalText,
  parseFormData,
  text,
} from "~/lib/form";
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

/** The fields shared by create and update, from the Property form. */
const propertyFieldsSchema = z.object({
  name: text("Enter a name"),
  type: enumValue(PropertyType, "Choose a property type"),
  uniquePropertyId: optionalText(),
  propertyCategory: optionalEnumValue(
    PropertyCategory,
    "Choose a valid property category",
  ),
  ownershipType: optionalEnumValue(
    OwnershipType,
    "Choose a valid ownership type",
  ),
  addressLine1: text("Enter the address"),
  addressLine2: optionalText(),
  city: text("Enter the city"),
  state: text("Enter the state"),
  pinCode: text("Enter the PIN code"),
  country: optionalText().transform((country) => country ?? "India"),
  purchasePrice: optionalNumber("Enter a valid purchase price"),
  currentEstimatedValue: optionalNumber(
    "Enter a valid current estimated value",
  ),
  purchaseDate: optionalDate("Enter a valid purchase date"),
});

/** Creates a new `Property` for the signed-in owner. */
export async function createProperty(formData: FormData) {
  const session = await requireSession();
  const fields = parseFormData(propertyFieldsSchema, formData);

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
  const fields = parseFormData(propertyFieldsSchema, formData);

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
