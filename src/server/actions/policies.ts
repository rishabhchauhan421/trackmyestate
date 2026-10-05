"use server";

/**
 * Server Actions for the Insurance (Policy) feature. Like `Investment` and
 * `Loan`, a `Policy` can be edited in full after creation — its status in
 * particular is meant to be kept up to date by the owner as it lapses,
 * matures or is claimed. It can only be hard-removed (`deletePolicy`, a
 * soft delete via `deletedAt`) if it has no premium or claim `Bill` on
 * record. Every mutation re-checks ownership itself rather than trusting
 * the caller, since these are invoked directly from client forms.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { z } from "zod";

import { PolicyStatus, PolicyType } from "../../../generated/prisma";
import {
  date,
  enumValue,
  optionalNumber,
  optionalText,
  parseFormData,
  text,
} from "~/lib/form";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { NOT_SOFT_DELETED } from "~/server/queries/shared";

async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/");
  return session;
}

async function requireOwnedPolicy(policyId: string, ownerId: string) {
  const policy = await db.policy.findFirst({
    where: { id: policyId, ownerId, ...NOT_SOFT_DELETED },
  });
  if (!policy) throw new Error("Policy not found");
  return policy;
}

/** The fields shared by create and update, from the Policy form. */
const policyFieldsSchema = z.object({
  type: enumValue(PolicyType, "Choose a policy type"),
  insurer: text("Enter the insurer"),
  policyNumber: text("Enter the policy number"),
  holderName: text("Enter the policyholder's name"),
  startDate: date("Enter a valid start date"),
  // Optional comma-separated list of names.
  nominees: optionalText().transform((raw) =>
    (raw ?? "")
      .split(",")
      .map((nominee) => nominee.trim())
      .filter(Boolean),
  ),
  tenureYears: optionalNumber("Enter a valid tenure in years", {
    int: true,
    positive: true,
  }),
  sumAssured: optionalNumber("Enter a valid sum assured"),
  roomRentLimit: optionalNumber("Enter a valid room rent limit"),
  coPayPercent: optionalNumber("Enter a valid co-pay percent"),
  waitingPeriodMonths: optionalNumber("Enter a valid waiting period", {
    int: true,
    min: 0,
  }),
});

/** The Policy edit form, which also sets the policy's status. */
const policyUpdateSchema = policyFieldsSchema.extend({
  status: enumValue(PolicyStatus, "Choose a policy status"),
});

/** Creates a new `Policy` for the signed-in owner, defaulting `status` to `ACTIVE`. */
export async function createPolicy(formData: FormData) {
  const session = await requireSession();
  const fields = parseFormData(policyFieldsSchema, formData);

  await db.policy.create({
    data: { ownerId: session.user.id, ...fields },
  });

  revalidatePath("/insurance");
  redirect("/insurance");
}

/**
 * Updates every editable field of an existing `Policy` the owner holds,
 * including its `status` (e.g. marking it lapsed, matured or claimed).
 */
export async function updatePolicy(policyId: string, formData: FormData) {
  const session = await requireSession();
  await requireOwnedPolicy(policyId, session.user.id);
  const fields = parseFormData(policyUpdateSchema, formData);

  await db.policy.update({
    where: { id: policyId },
    data: fields,
  });

  revalidatePath("/insurance");
  redirect("/insurance");
}

/**
 * Soft-deletes a policy — refused if any premium or claim `Bill` has ever
 * been generated for it, since that history needs the policy record to
 * stay meaningful. Same rationale as `deleteLease`.
 */
export async function deletePolicy(policyId: string) {
  const session = await requireSession();
  await requireOwnedPolicy(policyId, session.user.id);

  const existingBill = await db.bill.findFirst({
    where: { policyId },
    select: { id: true },
  });
  if (existingBill) {
    throw new Error(
      "Cannot delete a policy that has premiums or claims on record",
    );
  }

  await db.policy.update({
    where: { id: policyId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/insurance");
  redirect("/insurance");
}
