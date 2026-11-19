"use server";

/**
 * Server Actions for the Insurance (Policy) feature. Like `Investment` and
 * `Loan`, a `Policy` can be edited in full after creation — its status in
 * particular is meant to be kept up to date by the owner as it lapses,
 * matures or is claimed. It can only be hard-removed (`deletePolicy`, a
 * soft delete via `deletedAt`) until money has been recorded against it.
 * Every mutation re-checks ownership itself rather than trusting the
 * caller, since these are invoked directly from client forms.
 *
 * A policy can carry two schedules, both kept in step through
 * `~/server/schedules/lifecycle`: its PREMIUM bills (amount, frequency and
 * a due date, until the term ends or the policy stops being active) and a
 * one-off PAYOUT (a maturity or survival benefit, money coming in).
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { z } from "zod";

import {
  PolicyStatus,
  PolicyType,
  PremiumFrequency,
} from "../../../generated/prisma";
import {
  date,
  enumValue,
  optionalDate,
  optionalEnumValue,
  optionalMoney,
  optionalNumber,
  optionalText,
  parseFormData,
  text,
} from "~/lib/form";
import { oneOffTerms, policyEndDate, premiumTerms } from "~/lib/schedule-terms";
import { generateBillsForSchedule } from "~/server/bills/generate";
import { db } from "~/server/db";
import { requireScope } from "~/server/households";
import { NOT_SOFT_DELETED } from "~/server/queries/shared";
import {
  hasPaymentHistory,
  retireSchedules,
  saveSchedule,
  todayFor,
  type ScheduleTx,
} from "~/server/schedules/lifecycle";

async function requireOwnedPolicy(policyId: string, householdId: string) {
  const policy = await db.policy.findFirst({
    where: { id: policyId, householdId, ...NOT_SOFT_DELETED },
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
  sumAssured: optionalMoney("Enter a valid sum assured"),
  roomRentLimit: optionalMoney("Enter a valid room rent limit"),
  coPayPercent: optionalNumber("Enter a valid co-pay percent"),
  waitingPeriodMonths: optionalNumber("Enter a valid waiting period", {
    int: true,
    min: 0,
  }),
});

/** The premium and payout fields: each group is all-or-nothing. */
const paymentFieldsSchema = z
  .object({
    premiumAmount: optionalMoney("Enter a valid premium amount", {
      positive: true,
    }),
    premiumFrequency: optionalEnumValue(
      PremiumFrequency,
      "Choose how often the premium is paid",
    ),
    premiumDueDate: optionalDate("Enter a valid premium due date"),
    payoutAmount: optionalMoney("Enter a valid payout amount", {
      positive: true,
    }),
    payoutDate: optionalDate("Enter a valid payout date"),
  })
  .refine(
    (f) =>
      (f.premiumAmount == null) === (f.premiumFrequency == null) &&
      (f.premiumAmount == null) === (f.premiumDueDate == null),
    {
      message:
        "Enter the premium amount, how often it's paid and a due date — or leave all three blank",
    },
  )
  .refine((f) => (f.payoutAmount == null) === (f.payoutDate == null), {
    message: "Enter both the payout amount and its date, or neither",
  });

const policyCreateSchema = z.intersection(
  policyFieldsSchema,
  paymentFieldsSchema,
);

/** The Policy edit form, which also sets the policy's status. */
const policyUpdateSchema = z.intersection(
  policyFieldsSchema.extend({
    status: enumValue(PolicyStatus, "Choose a policy status"),
  }),
  paymentFieldsSchema,
);

type PaymentFields = z.output<typeof paymentFieldsSchema>;

/**
 * Brings the policy's premium and payout schedules in line with the form.
 * Premiums stop once the policy isn't active. Returns the schedules to
 * generate bills for.
 */
async function syncPolicySchedules(
  tx: ScheduleTx,
  policy: {
    id: string;
    ownerId: string;
    householdId: string;
    status: PolicyStatus;
    startDate: Date;
    tenureYears: number | null;
  },
  fields: PaymentFields,
  today: Date,
): Promise<string[]> {
  const data = {
    ownerId: policy.ownerId,
    householdId: policy.householdId,
    policyId: policy.id,
  };
  const ids: string[] = [];

  if (
    policy.status === "ACTIVE" &&
    fields.premiumAmount != null &&
    fields.premiumFrequency &&
    fields.premiumDueDate
  ) {
    ids.push(
      await saveSchedule(tx, {
        owner: { policyId: policy.id },
        category: "PREMIUM",
        data,
        terms: premiumTerms(
          fields.premiumFrequency,
          fields.premiumDueDate,
          fields.premiumAmount,
          policyEndDate(policy.startDate, policy.tenureYears),
        ),
        today,
      }),
    );
  } else {
    await retireSchedules(
      tx,
      { policyId: policy.id, category: "PREMIUM" },
      { from: today },
    );
  }

  if (fields.payoutAmount != null && fields.payoutDate) {
    ids.push(
      await saveSchedule(tx, {
        owner: { policyId: policy.id },
        category: "PAYOUT",
        data,
        terms: oneOffTerms(fields.payoutDate, fields.payoutAmount),
        today,
      }),
    );
  } else {
    await retireSchedules(
      tx,
      { policyId: policy.id, category: "PAYOUT" },
      { from: today },
    );
  }
  return ids;
}

function splitPaymentFields<T extends PaymentFields>(fields: T) {
  const {
    premiumAmount,
    premiumFrequency,
    premiumDueDate,
    payoutAmount,
    payoutDate,
    ...policy
  } = fields;
  return {
    policy,
    payments: {
      premiumAmount,
      premiumFrequency,
      premiumDueDate,
      payoutAmount,
      payoutDate,
    },
  };
}

/** Creates a new `Policy` for the signed-in owner, defaulting `status` to `ACTIVE`. */
export async function createPolicy(formData: FormData) {
  const scope = await requireScope();
  const { policy: fields, payments } = splitPaymentFields(
    parseFormData(policyCreateSchema, formData),
  );
  const today = await todayFor(scope.userId);

  const scheduleIds = await db.$transaction(async (tx) => {
    const policy = await tx.policy.create({
      data: {
        ownerId: scope.userId,
        householdId: scope.householdId,
        ...fields,
      },
    });
    return syncPolicySchedules(
      tx,
      { ...policy, householdId: scope.householdId },
      payments,
      today,
    );
  });
  for (const id of scheduleIds) await generateBillsForSchedule(id);

  revalidatePath("/insurance");
  redirect("/insurance");
}

/**
 * Updates every editable field of an existing `Policy` the owner holds,
 * including its `status` (e.g. marking it lapsed, matured or claimed).
 */
export async function updatePolicy(policyId: string, formData: FormData) {
  const scope = await requireScope();
  const existing = await requireOwnedPolicy(policyId, scope.householdId);
  const { policy: fields, payments } = splitPaymentFields(
    parseFormData(policyUpdateSchema, formData),
  );
  const today = await todayFor(scope.userId);

  const scheduleIds = await db.$transaction(async (tx) => {
    await tx.policy.update({
      where: { id: policyId },
      data: fields,
    });
    return syncPolicySchedules(
      tx,
      {
        id: policyId,
        ownerId: existing.ownerId,
        householdId: scope.householdId,
        status: fields.status,
        startDate: fields.startDate,
        tenureYears: fields.tenureYears,
      },
      payments,
      today,
    );
  });
  for (const id of scheduleIds) await generateBillsForSchedule(id);

  revalidatePath("/insurance");
  redirect("/insurance");
}

/**
 * Soft-deletes a policy, its schedules and its unpaid bills — refused once
 * money has been recorded against it, since that history needs the policy
 * record to stay meaningful. Same rationale as `deleteLease`.
 */
export async function deletePolicy(policyId: string) {
  const scope = await requireScope();
  await requireOwnedPolicy(policyId, scope.householdId);

  if (await hasPaymentHistory(db, { policyId })) {
    throw new Error(
      "Cannot delete a policy that has premiums or payouts on record",
    );
  }

  const today = await todayFor(scope.userId);
  await db.$transaction(async (tx) => {
    await tx.policy.update({
      where: { id: policyId },
      data: { deletedAt: new Date() },
    });
    await retireSchedules(tx, { policyId }, { from: today, remove: true });
  });

  revalidatePath("/insurance");
  redirect("/insurance");
}
