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
 * `prisma/schema.prisma`. `createLoan`/`updateLoan` write both records.
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

import type { LoanType } from "../../../generated/prisma";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";

async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/");
  return session;
}

async function requireOwnedLoan(loanId: string, ownerId: string) {
  const loan = await db.loan.findFirst({ where: { id: loanId, ownerId } });
  if (!loan) throw new Error("Loan not found");
  return loan;
}

/** Parses and validates the fields shared by create and update, from the Loan form. */
function parseLoanFields(formData: FormData) {
  const lender = String(formData.get("lender") ?? "").trim();
  const type = String(formData.get("type")) as LoanType;
  const principal = Number(formData.get("principal"));
  const interestRatePercent = Number(formData.get("interestRatePercent"));
  const tenureMonths = Number(formData.get("tenureMonths"));
  const emiAmount = Number(formData.get("emiAmount"));
  const emiDueDay = Number(formData.get("emiDueDay"));
  const startDate = new Date(String(formData.get("startDate")));
  const outstandingBalanceRaw = String(
    formData.get("outstandingBalance") ?? "",
  ).trim();
  const outstandingBalance = outstandingBalanceRaw
    ? Number(outstandingBalanceRaw)
    : principal;
  const linkedPropertyId =
    String(formData.get("linkedPropertyId") ?? "").trim() || null;

  if (!lender) throw new Error("Enter a lender");
  if (!Number.isFinite(principal) || principal <= 0) {
    throw new Error("Enter a valid principal amount");
  }
  if (!Number.isFinite(interestRatePercent) || interestRatePercent < 0) {
    throw new Error("Enter a valid interest rate");
  }
  if (!Number.isInteger(tenureMonths) || tenureMonths <= 0) {
    throw new Error("Enter a valid tenure in months");
  }
  if (!Number.isFinite(emiAmount) || emiAmount <= 0) {
    throw new Error("Enter a valid EMI amount");
  }
  if (!Number.isInteger(emiDueDay) || emiDueDay < 1 || emiDueDay > 31) {
    throw new Error("Enter a valid EMI due day (1-31)");
  }
  if (Number.isNaN(startDate.getTime())) {
    throw new Error("Enter a valid start date");
  }
  if (!Number.isFinite(outstandingBalance) || outstandingBalance < 0) {
    throw new Error("Enter a valid outstanding balance");
  }

  return {
    lender,
    type,
    principal,
    interestRatePercent,
    tenureMonths,
    emiAmount,
    emiDueDay,
    startDate,
    outstandingBalance,
    linkedPropertyId,
  };
}

/**
 * Confirms a `linkedPropertyId` (if given) actually belongs to the owner,
 * the same way `createLease` checks a `roomId` — a loan can only be linked
 * to one of the signed-in owner's own properties.
 */
async function requireOwnedLinkedProperty(
  linkedPropertyId: string | null,
  ownerId: string,
) {
  if (!linkedPropertyId) return null;
  const property = await db.property.findFirst({
    where: { id: linkedPropertyId, ownerId },
  });
  if (!property) throw new Error("Property not found");
  return linkedPropertyId;
}

/** Creates a new `Loan` and its EMI `BillSchedule` for the signed-in owner. */
export async function createLoan(formData: FormData) {
  const session = await requireSession();
  const fields = parseLoanFields(formData);
  const linkedPropertyId = await requireOwnedLinkedProperty(
    fields.linkedPropertyId,
    session.user.id,
  );

  const loan = await db.loan.create({
    data: {
      ownerId: session.user.id,
      lender: fields.lender,
      type: fields.type,
      principal: fields.principal,
      interestRatePercent: fields.interestRatePercent,
      startDate: fields.startDate,
      outstandingBalance: fields.outstandingBalance,
      linkedPropertyId,
    },
  });

  await db.billSchedule.create({
    data: {
      ownerId: session.user.id,
      category: "EMI",
      loanId: loan.id,
      recurrence: "MONTHLY",
      dueDay: fields.emiDueDay,
      defaultAmount: fields.emiAmount,
      tenureMonths: fields.tenureMonths,
    },
  });

  revalidatePath("/loans");
  if (linkedPropertyId) revalidatePath(`/properties/${linkedPropertyId}`);
  redirect("/loans");
}

/** Updates every editable field of an existing `Loan` and its EMI `BillSchedule`. */
export async function updateLoan(loanId: string, formData: FormData) {
  const session = await requireSession();
  const existingLoan = await requireOwnedLoan(loanId, session.user.id);
  const fields = parseLoanFields(formData);
  const linkedPropertyId = await requireOwnedLinkedProperty(
    fields.linkedPropertyId,
    session.user.id,
  );

  await db.loan.update({
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

  await db.billSchedule.updateMany({
    where: { category: "EMI", loanId },
    data: {
      dueDay: fields.emiDueDay,
      defaultAmount: fields.emiAmount,
      tenureMonths: fields.tenureMonths,
    },
  });

  revalidatePath("/loans");
  if (existingLoan.linkedPropertyId) {
    revalidatePath(`/properties/${existingLoan.linkedPropertyId}`);
  }
  if (linkedPropertyId) revalidatePath(`/properties/${linkedPropertyId}`);
  redirect("/loans");
}

/**
 * Soft-deletes a loan and its EMI `BillSchedule` — refused if any EMI
 * `Bill` has ever been generated for it, since that payment history needs
 * the loan record to stay meaningful. Same rationale as `deleteLease`.
 */
export async function deleteLoan(loanId: string) {
  const session = await requireSession();
  const loan = await requireOwnedLoan(loanId, session.user.id);

  const existingBill = await db.bill.findFirst({
    where: { loanId },
    select: { id: true },
  });
  if (existingBill) {
    throw new Error("Cannot delete a loan that has EMI payments on record");
  }

  await db.loan.update({
    where: { id: loanId },
    data: { deletedAt: new Date() },
  });
  await db.billSchedule.updateMany({
    where: { category: "EMI", loanId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/loans");
  if (loan.linkedPropertyId) revalidatePath(`/properties/${loan.linkedPropertyId}`);
  redirect("/loans");
}
