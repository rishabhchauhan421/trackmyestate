"use server";

/**
 * Server Actions for `Bill` — the shared "amount due on a date, later
 * paid/received" record behind every asset (utility bills, EMIs, premiums,
 * rent, and so on; see `prisma/schema.prisma`'s `Bill` model comment).
 * Owners never create a bill directly — that's the bill generator's job
 * (`~/server/bills/generate`, via `createBill` in `~/server/bills/create`,
 * which deliberately lives outside this `"use server"` file so it can't
 * become a public endpoint).
 * `recordBillPayment` is the one mutation an owner does trigger directly,
 * from the bill's page (`/bills/[id]`).
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { z } from "zod";

import { PaymentMethod } from "../../../generated/prisma";
import {
  checkbox,
  date,
  enumValue,
  money,
  optionalText,
  parseFormData,
} from "~/lib/form";
import { db } from "~/server/db";
import { requireScope } from "~/server/households";
import { OPEN_PAYMENT_STATUSES } from "~/server/queries/shared";

/** The "record a payment" form on a bill's page. */
const recordPaymentSchema = z.object({
  paidOn: date("Enter a valid date", "Enter the date it was paid"),
  amount: money(
    "Enter an amount greater than zero",
    { positive: true },
    "Enter the amount paid",
  ),
  method: enumValue(PaymentMethod, "Choose how it was paid"),
  reference: optionalText(),
  // Ticked: this payment closes the bill even if the amount differs from
  // what was due (a variable bill came in lower, a discount, rounding).
  settles: checkbox(),
});

async function requireOwnedBill(billId: string, householdId: string) {
  const bill = await db.bill.findFirst({ where: { id: billId, householdId } });
  if (!bill) throw new Error("Bill not found");
  return bill;
}

const isOpen = (status: string) =>
  (OPEN_PAYMENT_STATUSES as readonly string[]).includes(status);

/**
 * Records a payment against a bill: a `PaymentTransaction` for the money
 * that moved, and the bill's running `paidAmount` and status. The bill is
 * PAID once the payments cover what was due, or when the owner says this
 * payment settles it; otherwise it's PARTIALLY_PAID. Both writes happen in
 * one transaction so the total can't drift from the payments.
 */
export async function recordBillPayment(billId: string, formData: FormData) {
  const scope = await requireScope();
  const bill = await requireOwnedBill(billId, scope.householdId);
  if (!isOpen(bill.status)) {
    throw new Error("This bill is already closed");
  }

  const fields = parseFormData(recordPaymentSchema, formData);

  await db.$transaction(async (tx) => {
    // Read again inside the transaction so two payments saved at once
    // can't both start from the same total.
    const current = await tx.bill.findFirst({
      where: { id: bill.id, householdId: scope.householdId },
    });
    if (!current || !isOpen(current.status)) {
      throw new Error("This bill is already closed");
    }

    await tx.paymentTransaction.create({
      data: {
        ownerId: scope.userId,
        householdId: scope.householdId,
        category: current.category,
        billId: current.id,
        propertyId: current.propertyId,
        leaseId: current.leaseId,
        loanId: current.loanId,
        policyId: current.policyId,
        investmentId: current.investmentId,
        amount: fields.amount,
        currency: current.currency,
        paymentMethod: fields.method,
        referenceNumber: fields.reference,
        paidAt: fields.paidOn,
      },
    });

    const paidSoFar =
      current.status === "PARTIALLY_PAID" ? (current.paidAmount ?? 0) : 0;
    const totalPaid = paidSoFar + fields.amount;
    const settled = fields.settles || totalPaid >= current.amount;

    await tx.bill.update({
      where: { id: current.id },
      data: {
        paidAmount: totalPaid,
        status: settled ? "PAID" : "PARTIALLY_PAID",
        paidDate: settled ? fields.paidOn : null,
      },
    });
  });

  revalidatePath(`/bills/${bill.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/timeline");
  if (bill.propertyId) {
    revalidatePath(`/properties/${bill.propertyId}`);
    revalidatePath(`/properties/${bill.propertyId}/utilities`);
  }
  redirect(`/bills/${bill.id}?saved=1`);
}
