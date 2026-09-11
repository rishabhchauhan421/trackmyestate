"use server";

/**
 * Server Actions for the property Utilities feature.
 *
 * Model recap: a utility is a `BillSchedule` row (category `"BILL"`) — an
 * immutable template (type, provider, recurrence, amount, reminder lead
 * time) that can only be deactivated, not edited or deleted, once created.
 * `BillSchedule` is shared across every recurring-bill category (see the
 * model comment in `prisma/schema.prisma`); this file only ever touches
 * `category: "BILL"` rows. Its generated bill instances are `Bill` rows —
 * see `~/server/actions/bills` for `generateBill`/`markBillPaid`, shared
 * across every bill category. Every mutation below re-checks ownership
 * itself rather than trusting the caller, since these are invoked directly
 * from client forms.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type {
  BillingType,
  BillRecurrence,
  BillType,
} from "../../../generated/prisma";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";

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
    where: { id: utilityId, category: "BILL", ownerId },
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
  const propertyId = String(formData.get("propertyId"));
  const { session, property } = await requireOwnedProperty(propertyId);

  const billType = String(formData.get("type")) as BillType;
  const provider = String(formData.get("provider") ?? "").trim() || null;
  const accountNumber =
    String(formData.get("accountNumber") ?? "").trim() || null;
  const billingType = String(
    formData.get("billingType") ?? "VARIABLE",
  ) as BillingType;
  const recurrence = String(formData.get("recurrence")) as BillRecurrence;
  const defaultAmount = Number(formData.get("defaultAmount"));
  const firstDueDate = new Date(String(formData.get("firstDueDate")));
  const reminderLeadDays = Number(formData.get("reminderLeadDays") ?? 7);

  if (!Number.isFinite(defaultAmount) || defaultAmount <= 0) {
    throw new Error("Enter a valid amount");
  }
  if (Number.isNaN(firstDueDate.getTime())) {
    throw new Error("Enter a valid first due date");
  }

  await db.billSchedule.create({
    data: {
      ownerId: session.user.id,
      category: "BILL",
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
 * Adds a person to notify when a utility's bill is due/paid. Email
 * validation is intentionally shallow (just requires an `@`) — this isn't a
 * verified-delivery guarantee, just a basic input check.
 */
export async function addUtilityRecipient(utilityId: string, formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/");

  const utility = await requireOwnedUtility(utilityId, session.user.id);

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const notifyOnDue = formData.get("notifyOnDue") === "on";
  const notifyOnPaid = formData.get("notifyOnPaid") === "on";

  if (!name) throw new Error("Enter a name");
  if (!email.includes("@")) throw new Error("Enter a valid email");

  await db.billScheduleRecipient.create({
    data: {
      billScheduleId: utility.id,
      name,
      email,
      phone,
      notifyOnDue,
      notifyOnPaid,
      deletedAt: null,
    },
  });

  revalidatePath(`/properties/${utility.propertyId}/utilities`);
}

/** Soft-deletes a notification recipient (sets `deletedAt`, doesn't hard-delete). */
export async function removeUtilityRecipient(recipientId: string) {
  const session = await getSession();
  if (!session) redirect("/");

  const recipient = await db.billScheduleRecipient.findFirst({
    where: {
      id: recipientId,
      billSchedule: { ownerId: session.user.id },
    },
    include: { billSchedule: { select: { propertyId: true } } },
  });
  if (!recipient) throw new Error("Recipient not found");

  await db.billScheduleRecipient.update({
    where: { id: recipientId },
    data: { deletedAt: new Date() },
  });

  revalidatePath(`/properties/${recipient.billSchedule.propertyId}/utilities`);
}
