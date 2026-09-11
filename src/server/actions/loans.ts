"use server";

/**
 * Server Actions for the Loans feature. Unlike a utility `BillSchedule`
 * (immutable once created — see `~/server/actions/utilities`), a `Loan` can
 * be edited in full after creation: its outstanding balance in particular
 * is meant to be kept up to date by the owner over time.
 *
 * A loan's EMI schedule (tenure, due day, EMI amount) lives on its own
 * `BillSchedule` row (category `"EMI"`, `sourceId` = the Loan's id) rather
 * than on `Loan` itself — see the `BillSchedule` model comment in
 * `prisma/schema.prisma`. `createLoan`/`updateLoan` write both records;
 * the form itself is unchanged.
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
  };
}

/** Creates a new `Loan` and its EMI `BillSchedule` for the signed-in owner. */
export async function createLoan(formData: FormData) {
  const session = await requireSession();
  const fields = parseLoanFields(formData);

  const loan = await db.loan.create({
    data: {
      ownerId: session.user.id,
      lender: fields.lender,
      type: fields.type,
      principal: fields.principal,
      interestRatePercent: fields.interestRatePercent,
      startDate: fields.startDate,
      outstandingBalance: fields.outstandingBalance,
    },
  });

  await db.billSchedule.create({
    data: {
      ownerId: session.user.id,
      category: "EMI",
      sourceId: loan.id,
      recurrence: "MONTHLY",
      dueDay: fields.emiDueDay,
      defaultAmount: fields.emiAmount,
      tenureMonths: fields.tenureMonths,
    },
  });

  revalidatePath("/loans");
  redirect("/loans");
}

/** Updates every editable field of an existing `Loan` and its EMI `BillSchedule`. */
export async function updateLoan(loanId: string, formData: FormData) {
  const session = await requireSession();
  await requireOwnedLoan(loanId, session.user.id);
  const fields = parseLoanFields(formData);

  await db.loan.update({
    where: { id: loanId },
    data: {
      lender: fields.lender,
      type: fields.type,
      principal: fields.principal,
      interestRatePercent: fields.interestRatePercent,
      startDate: fields.startDate,
      outstandingBalance: fields.outstandingBalance,
    },
  });

  await db.billSchedule.updateMany({
    where: { category: "EMI", sourceId: loanId },
    data: {
      dueDay: fields.emiDueDay,
      defaultAmount: fields.emiAmount,
      tenureMonths: fields.tenureMonths,
    },
  });

  revalidatePath("/loans");
  redirect("/loans");
}
