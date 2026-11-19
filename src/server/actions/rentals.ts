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

import { z } from "zod";

import {
  FormError,
  optionalNumber,
  optionalText,
  parseFormData,
  text,
} from "~/lib/form";
import { db } from "~/server/db";
import { toFormState, type FormState } from "~/server/form-state";
import { requireScope } from "~/server/households";

/** The "Add rental unit" form. */
const rentalSchema = z.object({
  propertyId: text("Property not found"),
  label: text("Enter a label for this rental unit"),
  floor: optionalText(),
  areaSqft: optionalNumber("Enter a valid area", { positive: true }),
});

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
    throw new FormError("Self-occupied properties can't have rental units");
  }
  return { scope, property };
}

/** Creates a new rental unit (`Room`) for a property, from the "Add rental unit" form. */
export async function createRental(formData: FormData) {
  const { propertyId, label, floor, areaSqft } = parseFormData(
    rentalSchema,
    formData,
  );
  await requireRentableProperty(propertyId);

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

// Form twins for `ActionForm` (see `~/server/form-state`).

export async function createRentalForm(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  return toFormState(() => createRental(formData));
}
