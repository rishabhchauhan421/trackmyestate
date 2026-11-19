"use server";

/**
 * Server Actions for the Loans feature. Unlike a utility `BillSchedule`
 * (immutable once created — see `~/server/actions/utilities`), a `Loan` can
 * be edited in full after creation: its outstanding balance in particular
 * is meant to be kept up to date by the owner over time.
 *
 * A loan's EMI schedule (tenure, due day, EMI amount) lives on its own
 * `BillSchedule` row (category `"EMI"`, `loanId` = the Loan's id) rather
 * than on `Loan` itself — see the `BillSchedule` model comment in
 * `prisma/schema.prisma`. `createLoan`/`updateLoan` write both records in
 * one transaction, through `~/server/schedules/lifecycle` so a changed EMI
 * replaces the upcoming unpaid EMI bills.
 *
 * A loan can optionally be linked to one of the owner's properties
 * (`linkedPropertyId`, an "Exclusive Arc" on `Loan` — see the model
 * comment) so its EMI bills surface on that property's page even though
 * the `Bill` rows themselves only carry `loanId`, not `propertyId` — see
 * `getAllBillsForProperty` in `~/server/queries/bills`.
 *
 * Every mutation re-checks ownership itself rather than trusting the
 * caller, since these are invoked directly from client forms.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { z } from "zod";

import { LoanType } from "../../../generated/prisma";
import {
  date,
  enumValue,
  FormError,
  money,
  number,
  optionalMoney,
  optionalText,
  parseFormData,
  text,
} from "~/lib/form";
import { calendarDayOf, dateOnly } from "~/lib/calendar-day";
import { firstDueDayAfter } from "~/lib/schedule";
import { generateBillsForSchedule } from "~/server/bills/generate";
import { db } from "~/server/db";
import { toFormState, type FormState } from "~/server/form-state";
import { requireScope } from "~/server/households";
import {
  hasPaymentHistory,
  retireSchedules,
  saveSchedule,
  todayFor,
  type ScheduleTerms,
} from "~/server/schedules/lifecycle";

async function requireOwnedLoan(loanId: string, householdId: string) {
  const loan = await db.loan.findFirst({ where: { id: loanId, householdId } });
  if (!loan) throw new FormError("Loan not found");
  return loan;
}

/**
 * The fields shared by create and update, from the Loan form. A blank
 * outstanding balance defaults to the full principal (a brand-new loan).
 */
const loanFieldsSchema = z
  .object({
    lender: text("Enter a lender"),
    type: enumValue(LoanType, "Choose a loan type"),
    principal: money("Enter a valid principal amount", { positive: true }),
    interestRatePercent: number("Enter an interest rate from 0 to 100%", {
      min: 0,
      max: 100,
    }),
    tenureMonths: number("Enter a valid tenure in months", {
      int: true,
      positive: true,
    }),
    emiAmount: money("Enter a valid EMI amount", { positive: true }),
    emiDueDay: number("Enter a valid EMI due day (1-31)", {
      int: true,
      min: 1,
      max: 31,
    }),
    startDate: date("Enter a valid start date"),
    outstandingBalance: optionalMoney("Enter a valid outstanding balance", {
      min: 0,
    }),
    linkedPropertyId: optionalText(),
  })
  .transform((fields) => ({
    ...fields,
    outstandingBalance: fields.outstandingBalance ?? fields.principal,
  }));

/**
 * Confirms a `linkedPropertyId` (if given) actually belongs to the owner,
 * the same way `createLease` checks a `roomId` — a loan can only be linked
 * to one of the signed-in owner's own properties.
 */
async function requireOwnedLinkedProperty(
  linkedPropertyId: string | null,
  householdId: string,
) {
  if (!linkedPropertyId) return null;
  const property = await db.property.findFirst({
    where: { id: linkedPropertyId, householdId },
  });
  if (!property) throw new FormError("Property not found");
  return linkedPropertyId;
}

/** The first EMI: the first EMI due day after the loan starts. */
function firstEmiDate(loanStart: Date, emiDueDay: number) {
  return dateOnly(firstDueDayAfter(calendarDayOf(loanStart), emiDueDay));
}

/** The EMI schedule the form describes. */
function emiTerms(fields: z.output<typeof loanFieldsSchema>): ScheduleTerms {
  return {
    recurrence: "MONTHLY",
    startDate: firstEmiDate(fields.startDate, fields.emiDueDay),
    dueDay: fields.emiDueDay,
    tenureMonths: fields.tenureMonths,
    defaultAmount: fields.emiAmount,
  };
}

/** Creates a new `Loan` and its EMI `BillSchedule` for the signed-in owner. */
export async function createLoan(formData: FormData) {
  const scope = await requireScope();
  const fields = parseFormData(loanFieldsSchema, formData);
  const linkedPropertyId = await requireOwnedLinkedProperty(
    fields.linkedPropertyId,
    scope.householdId,
  );

  const today = await todayFor(scope.userId);

  const scheduleId = await db.$transaction(async (tx) => {
    const loan = await tx.loan.create({
      data: {
        ownerId: scope.userId,
        householdId: scope.householdId,
        lender: fields.lender,
        type: fields.type,
        principal: fields.principal,
        interestRatePercent: fields.interestRatePercent,
        startDate: fields.startDate,
        outstandingBalance: fields.outstandingBalance,
        linkedPropertyId,
      },
    });
    return saveSchedule(tx, {
      owner: { loanId: loan.id },
      category: "EMI",
      data: {
        ownerId: scope.userId,
        householdId: scope.householdId,
        loanId: loan.id,
      },
      terms: emiTerms(fields),
      today,
    });
  });
  // Create its first EMI bills now, so the next one shows up straight away.
  await generateBillsForSchedule(scheduleId);

  revalidatePath("/loans");
  if (linkedPropertyId) revalidatePath(`/properties/${linkedPropertyId}`);
  redirect("/loans");
}

/** Updates every editable field of an existing `Loan` and its EMI `BillSchedule`. */
export async function updateLoan(loanId: string, formData: FormData) {
  const scope = await requireScope();
  const existingLoan = await requireOwnedLoan(loanId, scope.householdId);
  const fields = parseFormData(loanFieldsSchema, formData);
  const linkedPropertyId = await requireOwnedLinkedProperty(
    fields.linkedPropertyId,
    scope.householdId,
  );

  const today = await todayFor(scope.userId);

  const scheduleId = await db.$transaction(async (tx) => {
    await tx.loan.update({
      where: { id: loanId },
      data: {
        lender: fields.lender,
        type: fields.type,
        principal: fields.principal,
        interestRatePercent: fields.interestRatePercent,
        startDate: fields.startDate,
        outstandingBalance: fields.outstandingBalance,
        linkedPropertyId,
      },
    });
    // A changed EMI, due day or tenure replaces the upcoming unpaid EMIs.
    return saveSchedule(tx, {
      owner: { loanId },
      category: "EMI",
      data: {
        ownerId: existingLoan.ownerId,
        householdId: scope.householdId,
        loanId,
      },
      terms: emiTerms(fields),
      today,
    });
  });
  await generateBillsForSchedule(scheduleId);

  revalidatePath("/loans");
  if (existingLoan.linkedPropertyId) {
    revalidatePath(`/properties/${existingLoan.linkedPropertyId}`);
  }
  if (linkedPropertyId) revalidatePath(`/properties/${linkedPropertyId}`);
  redirect("/loans");
}

/**
 * Soft-deletes a loan, stops its EMI schedule and removes its unpaid EMI
 * bills — refused once any EMI has been paid, since that payment history
 * needs the loan record to stay meaningful. Same rationale as
 * `deleteLease`.
 */
export async function deleteLoan(loanId: string) {
  const scope = await requireScope();
  const loan = await requireOwnedLoan(loanId, scope.householdId);

  if (await hasPaymentHistory(db, { loanId })) {
    throw new FormError("Cannot delete a loan that has EMI payments on record");
  }

  const today = await todayFor(scope.userId);
  await db.$transaction(async (tx) => {
    await tx.loan.update({
      where: { id: loanId },
      data: { deletedAt: new Date() },
    });
    await retireSchedules(tx, { loanId }, { from: today, remove: true });
  });

  revalidatePath("/loans");
  if (loan.linkedPropertyId)
    revalidatePath(`/properties/${loan.linkedPropertyId}`);
  redirect("/loans");
}

// Form twins for `ActionForm` (see `~/server/form-state`).

export async function createLoanForm(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  return toFormState(() => createLoan(formData));
}

export async function updateLoanForm(
  loanId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  return toFormState(() => updateLoan(loanId, formData));
}

export async function deleteLoanForm(
  loanId: string,
  _state: FormState,
  _formData: FormData,
): Promise<FormState> {
  return toFormState(() => deleteLoan(loanId));
}
