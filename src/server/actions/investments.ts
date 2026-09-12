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

import type { InvestmentType } from "../../../generated/prisma";
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

/** Parses and validates the fields shared by create and update, from the Investment form. */
function parseInvestmentFields(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type")) as InvestmentType;
  const institution = String(formData.get("institution") ?? "").trim() || null;
  const investedDate = new Date(String(formData.get("investedDate")));
  const capitalDeployed = Number(formData.get("capitalDeployed"));
  const expectedReturnType =
    String(formData.get("expectedReturnType") ?? "").trim() || null;
  const expectedReturnDateRaw = String(
    formData.get("expectedReturnDate") ?? "",
  ).trim();
  const expectedReturnDate = expectedReturnDateRaw
    ? new Date(expectedReturnDateRaw)
    : null;
  const targetRoiPercentRaw = String(
    formData.get("targetRoiPercent") ?? "",
  ).trim();
  const targetRoiPercent = targetRoiPercentRaw
    ? Number(targetRoiPercentRaw)
    : null;
  const currentEstimatedValueRaw = String(
    formData.get("currentEstimatedValue") ?? "",
  ).trim();
  const currentEstimatedValue = currentEstimatedValueRaw
    ? Number(currentEstimatedValueRaw)
    : null;

  if (!name) throw new Error("Enter a name");
  if (!Number.isFinite(capitalDeployed) || capitalDeployed <= 0) {
    throw new Error("Enter a valid capital deployed amount");
  }
  if (Number.isNaN(investedDate.getTime())) {
    throw new Error("Enter a valid invested date");
  }
  if (expectedReturnDate && Number.isNaN(expectedReturnDate.getTime())) {
    throw new Error("Enter a valid expected return date");
  }
  if (targetRoiPercent != null && !Number.isFinite(targetRoiPercent)) {
    throw new Error("Enter a valid target ROI");
  }
  if (
    currentEstimatedValue != null &&
    !Number.isFinite(currentEstimatedValue)
  ) {
    throw new Error("Enter a valid current estimated value");
  }

  return {
    name,
    type,
    institution,
    investedDate,
    capitalDeployed,
    expectedReturnType,
    expectedReturnDate,
    targetRoiPercent,
    currentEstimatedValue,
  };
}

/** Creates a new `Investment` for the signed-in owner. */
export async function createInvestment(formData: FormData) {
  const session = await requireSession();
  const fields = parseInvestmentFields(formData);

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
  const fields = parseInvestmentFields(formData);

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
