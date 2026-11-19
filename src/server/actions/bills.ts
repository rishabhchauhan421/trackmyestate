"use server";

/**
 * Server Actions for `Bill` — the shared "amount due on a date, later
 * paid/received" record behind every asset (utility bills, EMIs, premiums,
 * rent, and so on; see `prisma/schema.prisma`'s `Bill` model comment).
 * Owners never create a bill directly — that's the bill generator's job
 * (`~/server/bills/generate`, via `createBill` in `~/server/bills/create`,
 * which deliberately lives outside this `"use server"` file so it can't
 * become a public endpoint).
 * `markBillPaid` is the one mutation an owner does trigger directly, from a
 * bill's own edit page.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { z } from "zod";

import { date, parseFormData } from "~/lib/form";
import { db } from "~/server/db";
import { requireScope } from "~/server/households";

/** The "mark paid" form on a bill's edit page. */
const markBillPaidSchema = z.object({
  paidOn: date("Enter a valid paid date", "Enter the date the bill was paid"),
});

async function requireOwnedBill(billId: string, householdId: string) {
  const bill = await db.bill.findFirst({ where: { id: billId, householdId } });
  if (!bill) throw new Error("Bill not found");
  return bill;
}

/**
 * Marks a bill paid. Called from the bill's own edit page, where `paidOn`
 * is a required date input — the bill was actually paid on that date, not
 * necessarily today. Idempotent: marking an already-PAID bill paid again
 * just re-applies the same update.
 */
export async function markBillPaid(billId: string, formData: FormData) {
  const scope = await requireScope();
  const bill = await requireOwnedBill(billId, scope.householdId);

  const { paidOn: paidDate } = parseFormData(markBillPaidSchema, formData);

  await db.bill.update({
    where: { id: billId },
    data: { status: "PAID", paidDate, paidAmount: bill.amount },
  });

  // Only property-scoped categories (utility bills, rent) have a bills list
  // page to bounce back to today — other categories just get their status
  // synced above until their own page exists.
  if (bill.propertyId) {
    revalidatePath(`/properties/${bill.propertyId}/utilities`);
    redirect(`/properties/${bill.propertyId}/utilities`);
  }
}
