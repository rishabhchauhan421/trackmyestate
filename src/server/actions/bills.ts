"use server";

/**
 * Server Actions for `Bill` — the shared "amount due on a date, later
 * paid/received" record behind every asset (utility bills, EMIs, premiums,
 * rent, and so on; see `prisma/schema.prisma`'s `Bill` model comment).
 * Owners never create a bill directly — that's the job of a (not-yet-built)
 * background job per `BillSchedule` template (a utility, a loan's EMI
 * schedule, a policy premium, a tenant's rent) that calls `generateBill` on
 * the date of each cycle's first notification, or once for a one-time event
 * (a payout, a claim, a return).
 * `markBillPaid` is the one mutation an owner does trigger directly, from a
 * bill's own edit page.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type {
  FinancialEventSource,
  FinancialEventType,
} from "../../../generated/prisma";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";

async function requireOwnedBill(billId: string, ownerId: string) {
  const bill = await db.bill.findFirst({ where: { id: billId, ownerId } });
  if (!bill) throw new Error("Bill not found");
  return bill;
}

/**
 * Creates one `Bill` and its matching `FinancialEvent`. `category` and
 * `direction` reuse `FinancialEventSource`/`FinancialEventType` — the same
 * enums `FinancialEvent` already uses — so the two rows always agree on
 * what kind of bill this is and which way the money moves. `description`
 * is caller-built, since how you'd label a bill (utility type + provider,
 * "Home loan EMI - SBI", an annual premium, ...) is domain-specific.
 */
export async function generateBill(args: {
  ownerId: string;
  category: FinancialEventSource;
  direction: FinancialEventType;
  sourceId: string;
  propertyId?: string;
  amount: number;
  dueDate: Date;
  description: string;
}) {
  const {
    ownerId,
    category,
    direction,
    sourceId,
    propertyId,
    amount,
    dueDate,
    description,
  } = args;

  const bill = await db.bill.create({
    data: {
      ownerId,
      category,
      direction,
      sourceId,
      propertyId,
      dueDate,
      amount,
      status: "DUE",
    },
  });

  await db.financialEvent.create({
    data: {
      ownerId,
      type: direction,
      source: category,
      sourceId: bill.id,
      amount,
      dueDate,
      status: "DUE",
      description,
    },
  });

  return bill;
}

/**
 * Marks a bill paid and syncs its `FinancialEvent` to match. Called from
 * the bill's own edit page, where `paidOn` is a required date input — the
 * bill was actually paid on that date, not necessarily today. Idempotent:
 * marking an already-PAID bill paid again just re-applies the same update.
 */
export async function markBillPaid(billId: string, formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/");

  const bill = await requireOwnedBill(billId, session.user.id);

  const paidOn = String(formData.get("paidOn") ?? "").trim();
  if (!paidOn) throw new Error("Enter the date the bill was paid");
  const paidDate = new Date(paidOn);
  if (Number.isNaN(paidDate.getTime())) {
    throw new Error("Enter a valid paid date");
  }

  await db.bill.update({
    where: { id: billId },
    data: { status: "PAID", paidDate, paidAmount: bill.amount },
  });

  await db.financialEvent.updateMany({
    where: { source: bill.category, sourceId: billId },
    data: { status: "PAID" },
  });

  // Only property-scoped categories (utility bills, rent) have a bills list
  // page to bounce back to today — other categories just get their ledger
  // synced above until their own page exists.
  if (bill.propertyId) {
    revalidatePath(`/properties/${bill.propertyId}/utilities`);
    redirect(`/properties/${bill.propertyId}/utilities`);
  }
}
