"use server";

/**
 * Server Actions for `Bill` — the shared "amount due on a date, later
 * paid/received" record behind every asset (utility bills, EMIs, premiums,
 * rent, and so on; see `prisma/schema.prisma`'s `Bill` model comment).
 * Owners never create a bill directly — that's the bill generator's job
 * (`~/server/bills/generate`, via `createBill` in `~/server/bills/create`,
 * which deliberately lives outside this `"use server"` file so it can't
 * become a public endpoint).
 * `recordBillPayment` is the mutation an owner triggers directly, from the
 * bill's page (`/bills/[id]`); the "Mark paid" link in a reminder email is
 * `~/server/actions/bill-paid-link`.
 */

import { redirect } from "next/navigation";

import { z } from "zod";

import { PaymentMethod } from "../../../generated/prisma";
import {
  checkbox,
  date,
  enumValue,
  FormError,
  money,
  optionalText,
  parseFormData,
} from "~/lib/form";
import {
  applyBillPayment,
  isOpenBill,
  revalidateBillPages,
} from "~/server/bills/pay";
import { db } from "~/server/db";
import { toFormState, type FormState } from "~/server/form-state";
import { requireScope } from "~/server/households";

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
  if (!bill) throw new FormError("Bill not found");
  return bill;
}

/**
 * Records a payment against a bill from its page — see `applyBillPayment`
 * for what gets written. A partial payment leaves the bill open.
 */
export async function recordBillPayment(billId: string, formData: FormData) {
  const scope = await requireScope();
  const bill = await requireOwnedBill(billId, scope.householdId);
  if (!isOpenBill(bill.status)) {
    throw new FormError("This bill is already closed");
  }

  const fields = parseFormData(recordPaymentSchema, formData);

  const recorded = await applyBillPayment(
    { id: bill.id, householdId: scope.householdId },
    {
      payerId: scope.userId,
      amount: fields.amount,
      paidOn: fields.paidOn,
      method: fields.method,
      reference: fields.reference,
      settles: fields.settles,
    },
  );
  if (!recorded) throw new FormError("This bill is already closed");

  revalidateBillPages(bill);
  redirect(`/bills/${bill.id}?saved=1`);
}

// Form twins for `ActionForm` (see `~/server/form-state`).

export async function recordBillPaymentForm(
  billId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  return toFormState(() => recordBillPayment(billId, formData));
}
