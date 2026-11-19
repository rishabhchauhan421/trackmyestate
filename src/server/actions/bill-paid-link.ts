"use server";

/**
 * The public action behind the "Mark paid" link in the owner's reminder
 * emails (see `~/server/bills/paid-link`). Nobody is signed in here: the
 * signed link is the authorisation, so the signature is checked before
 * anything is read or written.
 *
 * It settles the bill in full, dated today where the owner is. A bill
 * that's already closed is left as it is, so a second click (or an old
 * email) does nothing.
 */

import { redirect } from "next/navigation";

import { z } from "zod";

import { PaymentMethod } from "../../../generated/prisma";
import { dateOnly } from "~/lib/calendar-day";
import { enumValue, parseFormData } from "~/lib/form";
import { resolveTimeZone, todayInTimeZone } from "~/lib/time-zone";
import { verifyBillPaid } from "~/server/bills/paid-link";
import { applyBillPayment, revalidateBillPages } from "~/server/bills/pay";
import { db } from "~/server/db";

const schema = z.object({
  method: enumValue(PaymentMethod, "Choose how it was paid"),
});

export async function markBillPaidFromLink(
  billId: string,
  sig: string,
  formData: FormData,
) {
  if (!verifyBillPaid(billId, sig)) throw new Error("This link isn't valid");

  const { method } = parseFormData(schema, formData);

  const bill = await db.bill.findFirst({
    where: { id: billId },
    select: {
      id: true,
      ownerId: true,
      propertyId: true,
      owner: { select: { timezone: true } },
    },
  });
  if (!bill) throw new Error("This link isn't valid");

  const today = todayInTimeZone(resolveTimeZone(bill.owner.timezone));
  const recorded = await applyBillPayment(
    { id: bill.id },
    {
      payerId: bill.ownerId,
      paidOn: dateOnly(today),
      method,
      reference: null,
      settles: true,
    },
  );
  if (recorded) revalidateBillPages(bill);

  const params = new URLSearchParams({ bill: billId, sig, done: "1" });
  redirect(`/reminders/paid?${params.toString()}`);
}
