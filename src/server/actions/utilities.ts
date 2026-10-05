"use server";

/**
 * Server Actions for the property Utilities feature.
 *
 * Model recap: a utility is a `BillSchedule` row (category `"UTILITY_BILL"`)
 * — an immutable template (type, provider, recurrence, amount, reminder
 * lead time) that can only be deactivated, not edited or deleted, once
 * created. `BillSchedule` is shared across every recurring-bill category
 * (see the model comment in `prisma/schema.prisma`); this file only ever
 * touches `category: "UTILITY_BILL"` rows. Its generated bill instances are `Bill` rows —
 * see `~/server/actions/bills` for `generateBill`/`markBillPaid`, shared
 * across every bill category. Every mutation below re-checks ownership
 * itself rather than trusting the caller, since these are invoked directly
 * from client forms.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { z } from "zod";

import {
  BillingType,
  BillRecurrence,
  BillType,
} from "../../../generated/prisma";
import {
  checkbox,
  date,
  email,
  enumValue,
  number,
  optionalEnumValue,
  optionalNumber,
  optionalText,
  parseFormData,
  text,
} from "~/lib/form";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";

/** The "Add utility" form. */
const utilitySchema = z.object({
  propertyId: text("Property not found"),
  type: enumValue(BillType, "Choose a utility type"),
  provider: optionalText(),
  accountNumber: optionalText(),
  billingType: optionalEnumValue(
    BillingType,
    "Choose a billing type",
  ).transform((billingType) => billingType ?? BillingType.VARIABLE),
  recurrence: enumValue(BillRecurrence, "Choose how often the bill recurs"),
  defaultAmount: number("Enter a valid amount", { positive: true }),
  firstDueDate: date("Enter a valid first due date"),
  reminderLeadDays: optionalNumber("Enter a valid reminder lead time", {
    int: true,
    min: 0,
  }).transform((days) => days ?? 7),
});

/** The "Add recipient" form on a utility. */
const utilityRecipientSchema = z.object({
  name: text("Enter a name"),
  email: email("Enter a valid email"),
  phone: optionalText(),
  notifyOnDue: checkbox(),
  notifyOnPaid: checkbox(),
});

/**
 * Loads a property, throwing if it doesn't exist or isn't owned by the
 * signed-in user (redirecting to `/` first if there's no session at all).
 * Shared by every action that mutates something scoped to a property.
 */
async function requireOwnedProperty(propertyId: string) {
  const session = await getSession();
  if (!session) redirect("/");
  const property = await db.property.findFirst({
    where: { id: propertyId, ownerId: session.user.id },
  });
  if (!property) throw new Error("Property not found");
  return { session, property };
}

/** Same as `requireOwnedProperty`, but for a utility `BillSchedule` row. */
async function requireOwnedUtility(utilityId: string, ownerId: string) {
  const utility = await db.billSchedule.findFirst({
    where: { id: utilityId, category: "UTILITY_BILL", ownerId },
  });
  if (!utility) throw new Error("Utility not found");
  return utility;
}

/**
 * Creates a new utility `BillSchedule` for a property, from the "Add
 * utility" form. Deliberately does **not** create a bill or financial
 * event — see `generateBill` in `~/server/actions/bills`. Once created, a
 * utility's fields are fixed; the only allowed change afterward is
 * `deactivateUtility`.
 */
export async function createUtility(formData: FormData) {
  const {
    propertyId,
    type: billType,
    provider,
    accountNumber,
    billingType,
    recurrence,
    defaultAmount,
    firstDueDate,
    reminderLeadDays,
  } = parseFormData(utilitySchema, formData);
  const { session } = await requireOwnedProperty(propertyId);

  await db.billSchedule.create({
    data: {
      ownerId: session.user.id,
      category: "UTILITY_BILL",
      propertyId,
      billType,
      provider,
      accountNumber,
      billingType,
      recurrence,
      dueDay: firstDueDate.getDate(),
      dueMonth: recurrence === "YEARLY" ? firstDueDate.getMonth() + 1 : null,
      reminderLeadDays,
      defaultAmount,
    },
  });

  revalidatePath(`/properties/${propertyId}/utilities`);
  redirect(`/properties/${propertyId}/utilities`);
}

/**
 * Marks a utility inactive. The only mutation a utility template allows
 * post-creation — there is no edit, and deliberately no "reactivate".
 */
export async function deactivateUtility(utilityId: string) {
  const session = await getSession();
  if (!session) redirect("/");

  const utility = await requireOwnedUtility(utilityId, session.user.id);

  await db.billSchedule.update({
    where: { id: utility.id },
    data: { active: false },
  });

  revalidatePath(`/properties/${utility.propertyId}/utilities`);
}

/**
 * Adds a person to notify when a utility's bill is due/paid. The email is
 * only format-checked — this isn't a verified-delivery guarantee.
 */
export async function addUtilityRecipient(
  utilityId: string,
  formData: FormData,
) {
  const session = await getSession();
  if (!session) redirect("/");

  const utility = await requireOwnedUtility(utilityId, session.user.id);

  const { name, email, phone, notifyOnDue, notifyOnPaid } = parseFormData(
    utilityRecipientSchema,
    formData,
  );

  await db.billSchedule.update({
    where: { id: utility.id },
    data: {
      recipients: {
        push: { name, email, phone, notifyOnDue, notifyOnPaid },
      },
    },
  });

  revalidatePath(`/properties/${utility.propertyId}/utilities`);
}

/**
 * Removes a person from a utility's notification recipients. Recipients are
 * an embedded array on `BillSchedule` (no independent id), so they're
 * identified by email — unique within one utility's recipient list.
 */
export async function removeUtilityRecipient(utilityId: string, email: string) {
  const session = await getSession();
  if (!session) redirect("/");

  const utility = await requireOwnedUtility(utilityId, session.user.id);

  await db.billSchedule.update({
    where: { id: utility.id },
    data: { recipients: { deleteMany: { where: { email } } } },
  });

  revalidatePath(`/properties/${utility.propertyId}/utilities`);
}
