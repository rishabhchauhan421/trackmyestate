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
  number,
  optionalDate,
  optionalNumber,
  optionalText,
  parseFormData,
  text,
} from "~/lib/form";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";

async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/");
  return session;
}

async function requireOwnedInvestment(investmentId: string, ownerId: string) {
  const investment = await db.investment.findFirst({
    where: { id: investmentId, ownerId },
  });
  if (!investment) throw new Error("Investment not found");
  return investment;
}

/** The fields shared by create and update, from the Investment form. */
const investmentFieldsSchema = z.object({
  name: text("Enter a name"),
  type: enumValue(InvestmentType, "Choose an investment type"),
  institution: optionalText(),
  investedDate: date("Enter a valid invested date"),
  capitalDeployed: number("Enter a valid capital deployed amount", {
    positive: true,
  }),
  expectedReturnType: optionalText(),
  expectedReturnDate: optionalDate("Enter a valid expected return date"),
  targetRoiPercent: optionalNumber("Enter a valid target ROI"),
  currentEstimatedValue: optionalNumber(
    "Enter a valid current estimated value",
  ),
});

/** Creates a new `Investment` for the signed-in owner. */
export async function createInvestment(formData: FormData) {
  const session = await requireSession();
  const fields = parseFormData(investmentFieldsSchema, formData);

  await db.investment.create({
    data: { ownerId: session.user.id, ...fields },
  });

  revalidatePath("/investments");
  redirect("/investments");
}

/** Updates every editable field of an existing `Investment` the owner holds. */
export async function updateInvestment(
  investmentId: string,
  formData: FormData,
) {
  const session = await requireSession();
  await requireOwnedInvestment(investmentId, session.user.id);
  const fields = parseFormData(investmentFieldsSchema, formData);

  await db.investment.update({
    where: { id: investmentId },
    data: fields,
  });

  revalidatePath("/investments");
  redirect("/investments");
}

/**
 * Soft-deletes an investment — refused if any `Bill` (payout or return) has
 * ever been generated for it, since that history needs the investment
 * record to stay meaningful. Same rationale as `deleteLease`.
 */
export async function deleteInvestment(investmentId: string) {
  const session = await requireSession();
  await requireOwnedInvestment(investmentId, session.user.id);

  const existingBill = await db.bill.findFirst({
    where: { investmentId },
    select: { id: true },
  });
  if (existingBill) {
    throw new Error("Cannot delete an investment that has bills on record");
  }

  await db.investment.update({
    where: { id: investmentId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/investments");
  redirect("/investments");
}
