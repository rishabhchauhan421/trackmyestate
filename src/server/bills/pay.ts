import "server-only";

import { revalidatePath } from "next/cache";

import type { PaymentMethod, Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";
import { OPEN_PAYMENT_STATUSES } from "~/server/queries/shared";

export const isOpenBill = (status: string) =>
  (OPEN_PAYMENT_STATUSES as readonly string[]).includes(status);

/** What's still owed on a bill, in minor units. */
export function outstandingAmount(bill: {
  amount: number;
  paidAmount: number | null;
  status: string;
}) {
  const paidSoFar =
    bill.status === "PARTIALLY_PAID" ? (bill.paidAmount ?? 0) : 0;
  return Math.max(bill.amount - paidSoFar, 0);
}

/**
 * Records a payment against the open bill matching `where`: a
 * `PaymentTransaction` for the money that moved, and the bill's running
 * `paidAmount` and status. The bill is PAID once the payments cover what
 * was due, or when `settles` says this payment closes it; otherwise it's
 * PARTIALLY_PAID. Settling an EMI also takes its principal share off the
 * loan's outstanding balance. The writes happen in one transaction so the
 * totals can't drift from the payments.
 *
 * Without an `amount`, the payment is for everything still owed. Returns
 * false, having written nothing, when there is no such bill or it's
 * already closed.
 *
 * Deliberately outside any `"use server"` file: callers decide who may pay
 * (the signed-in household, or a signed link) before calling it.
 */
export async function applyBillPayment(
  where: Prisma.BillWhereInput & { id: string },
  payment: {
    /** Who recorded it. */
    payerId: string;
    amount?: number;
    paidOn: Date;
    method: PaymentMethod;
    reference?: string | null;
    settles: boolean;
  },
) {
  return db.$transaction(async (tx) => {
    // Read inside the transaction so two payments saved at once can't both
    // start from the same total.
    const current = await tx.bill.findFirst({ where });
    if (!current || !isOpenBill(current.status)) return false;

    const amount = payment.amount ?? outstandingAmount(current);

    await tx.paymentTransaction.create({
      data: {
        ownerId: payment.payerId,
        householdId: current.householdId,
        category: current.category,
        billId: current.id,
        propertyId: current.propertyId,
        leaseId: current.leaseId,
        loanId: current.loanId,
        policyId: current.policyId,
        investmentId: current.investmentId,
        amount,
        currency: current.currency,
        paymentMethod: payment.method,
        referenceNumber: payment.reference ?? null,
        paidAt: payment.paidOn,
      },
    });

    const paidSoFar =
      current.status === "PARTIALLY_PAID" ? (current.paidAmount ?? 0) : 0;
    const totalPaid = paidSoFar + amount;
    const settled = payment.settles || totalPaid >= current.amount;

    await tx.bill.update({
      where: { id: current.id },
      data: {
        paidAmount: totalPaid,
        status: settled ? "PAID" : "PARTIALLY_PAID",
        paidDate: settled ? payment.paidOn : null,
      },
    });

    // A paid EMI repays its principal share of the loan.
    if (settled && current.loanId && current.principalComponent) {
      const loan = await tx.loan.findFirst({
        where: { id: current.loanId },
        select: { outstandingBalance: true },
      });
      if (loan) {
        await tx.loan.update({
          where: { id: current.loanId },
          data: {
            outstandingBalance: Math.max(
              loan.outstandingBalance - current.principalComponent,
              0,
            ),
          },
        });
      }
    }
    return true;
  });
}

/** Every page that shows a bill's status or totals. */
export function revalidateBillPages(bill: {
  id: string;
  propertyId: string | null;
}) {
  revalidatePath(`/bills/${bill.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/timeline");
  if (bill.propertyId) {
    revalidatePath(`/properties/${bill.propertyId}`);
    revalidatePath(`/properties/${bill.propertyId}/utilities`);
  }
}
