"use server";

/**
 * Server Actions for the Investments feature. Unlike a utility
 * `BillSchedule` (immutable once created — see `~/server/actions/utilities`),
 * an `Investment` can be edited in full after creation: its values
 * (current estimate, etc.) are meant to be kept up to date by the owner
 * over time. Every mutation re-checks ownership itself rather than
 * trusting the caller, since these are invoked directly from client forms.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { z } from "zod";

import { InvestmentType } from "../../../generated/prisma";
import {
  date,
  enumValue,
  FormError,
  money,
  optionalDate,
  optionalMoney,
  optionalNumber,
  optionalText,
  parseFormData,
  text,
} from "~/lib/form";
import { expectedReturnAmount, oneOffTerms } from "~/lib/schedule-terms";
import { generateBillsForSchedule } from "~/server/bills/generate";
import { db } from "~/server/db";
import { toFormState, type FormState } from "~/server/form-state";
import { requireScope } from "~/server/households";
import {
  hasPaymentHistory,
  retireSchedules,
  saveSchedule,
  todayFor,
  type ScheduleTx,
} from "~/server/schedules/lifecycle";

async function requireOwnedInvestment(
  investmentId: string,
  householdId: string,
) {
  const investment = await db.investment.findFirst({
    where: { id: investmentId, householdId },
  });
  if (!investment) throw new FormError("Investment not found");
  return investment;
}

/** The fields shared by create and update, from the Investment form. */
const investmentFieldsSchema = z.object({
  name: text("Enter a name"),
  type: enumValue(InvestmentType, "Choose an investment type"),
  institution: optionalText(),
  investedDate: date("Enter a valid invested date"),
  capitalDeployed: money("Enter a valid capital deployed amount", {
    positive: true,
  }),
  expectedReturnType: optionalText(),
  expectedReturnDate: optionalDate("Enter a valid expected return date"),
  // A loss can be at most 100%; a 1000% target is a typo, not a plan.
  targetRoiPercent: optionalNumber(
    "Enter a target return from -100% to 1000%",
    { min: -100, max: 1000 },
  ),
  currentEstimatedValue: optionalMoney("Enter a valid current estimated value"),
});

type InvestmentFields = z.output<typeof investmentFieldsSchema>;

/**
 * An investment with an expected return date gets a one-off
 * INVESTMENT_RETURN bill (money coming in) on that date; clearing the date
 * retires it. Returns the schedule to generate bills for, if any.
 */
async function syncReturnSchedule(
  tx: ScheduleTx,
  investment: { id: string; ownerId: string; householdId: string },
  fields: InvestmentFields,
  today: Date,
): Promise<string | null> {
  if (!fields.expectedReturnDate) {
    await retireSchedules(
      tx,
      { investmentId: investment.id, category: "INVESTMENT_RETURN" },
      { from: today },
    );
    return null;
  }
  return saveSchedule(tx, {
    owner: { investmentId: investment.id },
    category: "INVESTMENT_RETURN",
    data: {
      ownerId: investment.ownerId,
      householdId: investment.householdId,
      investmentId: investment.id,
    },
    terms: oneOffTerms(fields.expectedReturnDate, expectedReturnAmount(fields)),
    today,
  });
}

/** Creates a new `Investment` for the signed-in owner. */
export async function createInvestment(formData: FormData) {
  const scope = await requireScope();
  const fields = parseFormData(investmentFieldsSchema, formData);
  const today = await todayFor(scope.userId);

  const scheduleId = await db.$transaction(async (tx) => {
    const investment = await tx.investment.create({
      data: {
        ownerId: scope.userId,
        householdId: scope.householdId,
        ...fields,
      },
    });
    return syncReturnSchedule(
      tx,
      { ...investment, householdId: scope.householdId },
      fields,
      today,
    );
  });
  if (scheduleId) await generateBillsForSchedule(scheduleId);

  revalidatePath("/investments");
  redirect("/investments");
}

/** Updates every editable field of an existing `Investment` the owner holds. */
export async function updateInvestment(
  investmentId: string,
  formData: FormData,
) {
  const scope = await requireScope();
  const existing = await requireOwnedInvestment(
    investmentId,
    scope.householdId,
  );
  const fields = parseFormData(investmentFieldsSchema, formData);
  const today = await todayFor(scope.userId);

  const scheduleId = await db.$transaction(async (tx) => {
    await tx.investment.update({
      where: { id: investmentId },
      data: fields,
    });
    return syncReturnSchedule(
      tx,
      {
        id: investmentId,
        ownerId: existing.ownerId,
        householdId: scope.householdId,
      },
      fields,
      today,
    );
  });
  if (scheduleId) await generateBillsForSchedule(scheduleId);

  revalidatePath("/investments");
  redirect("/investments");
}

/**
 * Soft-deletes an investment, its return schedule and unpaid return bills
 * — refused once money has been received on it, since that history needs
 * the investment record to stay meaningful. Same rationale as
 * `deleteLease`.
 */
export async function deleteInvestment(investmentId: string) {
  const scope = await requireScope();
  await requireOwnedInvestment(investmentId, scope.householdId);

  if (await hasPaymentHistory(db, { investmentId })) {
    throw new FormError(
      "Cannot delete an investment that has returns on record",
    );
  }

  const today = await todayFor(scope.userId);
  await db.$transaction(async (tx) => {
    await tx.investment.update({
      where: { id: investmentId },
      data: { deletedAt: new Date() },
    });
    await retireSchedules(tx, { investmentId }, { from: today, remove: true });
  });

  revalidatePath("/investments");
  redirect("/investments");
}

// Form twins for `ActionForm` (see `~/server/form-state`).

export async function createInvestmentForm(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  return toFormState(() => createInvestment(formData));
}

export async function updateInvestmentForm(
  investmentId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  return toFormState(() => updateInvestment(investmentId, formData));
}

export async function deleteInvestmentForm(
  investmentId: string,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  return toFormState(() => deleteInvestment(investmentId));
}
