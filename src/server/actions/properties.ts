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
  FormError,
  notes,
  optionalDate,
  optionalEnumValue,
  optionalMoney,
  optionalText,
  parseFormData,
  text,
} from "~/lib/form";
import { db } from "~/server/db";
import { toFormState, type FormState } from "~/server/form-state";
import { requireScope } from "~/server/households";
import { hasDependentRecordsForProperty } from "~/server/queries/properties";
import { NOT_SOFT_DELETED } from "~/server/queries/shared";

async function requireOwnedProperty(propertyId: string, householdId: string) {
  const property = await db.property.findFirst({
    where: { id: propertyId, householdId, ...NOT_SOFT_DELETED },
  });
  if (!property) throw new FormError("Property not found");
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
  purchasePrice: optionalMoney("Enter a valid purchase price"),
  currentEstimatedValue: optionalMoney("Enter a valid current estimated value"),
  purchaseDate: optionalDate("Enter a valid purchase date"),
  notes: notes(),
});

/** Creates a new `Property` for the signed-in owner. */
export async function createProperty(formData: FormData) {
  const scope = await requireScope();
  const fields = parseFormData(propertyFieldsSchema, formData);

  await db.property.create({
    data: {
      ownerId: scope.userId,
      householdId: scope.householdId,
      ...fields,
    },
  });

  revalidatePath("/properties");
  redirect("/properties");
}

/** Updates every editable field of an existing `Property` the owner holds. */
export async function updateProperty(propertyId: string, formData: FormData) {
  const scope = await requireScope();
  await requireOwnedProperty(propertyId, scope.householdId);
  const fields = parseFormData(propertyFieldsSchema, formData);

  // A self-occupied property can't be rented out (see `createLease`), so it
  // can't become one while a tenant is still in it.
  if (fields.type === "SELF_OCCUPIED") {
    const activeLease = await db.lease.findFirst({
      where: { propertyId, active: true },
      select: { id: true },
    });
    if (activeLease) {
      throw new FormError(
        "End this property's active leases before marking it self-occupied",
        "type",
      );
    }
  }

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
  const scope = await requireScope();
  await requireOwnedProperty(propertyId, scope.householdId);

  if (await hasDependentRecordsForProperty(propertyId)) {
    throw new FormError(
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

// Form twins for `ActionForm` (see `~/server/form-state`).

export async function createPropertyForm(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  return toFormState(() => createProperty(formData));
}

export async function updatePropertyForm(
  propertyId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  return toFormState(() => updateProperty(propertyId, formData));
}

export async function deletePropertyForm(
  propertyId: string,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  return toFormState(() => deleteProperty(propertyId));
}
