"use server";

/**
 * Server Actions for the Insurance (Policy) feature. Like `Investment` and
 * `Loan`, a `Policy` can be edited in full after creation — its status in
 * particular is meant to be kept up to date by the owner as it lapses,
 * matures or is claimed. It can only be hard-removed (`deletePolicy`, a
 * soft delete via `deletedAt`) if it has no premium or claim `Bill` on
 * record. Every mutation re-checks ownership itself rather than trusting
 * the caller, since these are invoked directly from client forms.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { PolicyStatus, PolicyType } from "../../../generated/prisma";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { NOT_SOFT_DELETED } from "~/server/queries/shared";

async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/");
  return session;
}

async function requireOwnedPolicy(policyId: string, ownerId: string) {
  const policy = await db.policy.findFirst({
    where: { id: policyId, ownerId, ...NOT_SOFT_DELETED },
  });
  if (!policy) throw new Error("Policy not found");
  return policy;
}

/** Parses the optional comma-separated "nominees" field into a string list. */
function parseNominees(formData: FormData) {
  const raw = String(formData.get("nominees") ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((nominee) => nominee.trim())
    .filter(Boolean);
}

/** Parses and validates the fields shared by create and update, from the Policy form. */
function parsePolicyFields(formData: FormData) {
  const type = String(formData.get("type")) as PolicyType;
  const insurer = String(formData.get("insurer") ?? "").trim();
  const policyNumber = String(formData.get("policyNumber") ?? "").trim();
  const holderName = String(formData.get("holderName") ?? "").trim();
  const startDate = new Date(String(formData.get("startDate")));
  const nominees = parseNominees(formData);
  const tenureYearsRaw = String(formData.get("tenureYears") ?? "").trim();
  const tenureYears = tenureYearsRaw ? Number(tenureYearsRaw) : null;
  const sumAssuredRaw = String(formData.get("sumAssured") ?? "").trim();
  const sumAssured = sumAssuredRaw ? Number(sumAssuredRaw) : null;
  const roomRentLimitRaw = String(
    formData.get("roomRentLimit") ?? "",
  ).trim();
  const roomRentLimit = roomRentLimitRaw ? Number(roomRentLimitRaw) : null;
  const coPayPercentRaw = String(formData.get("coPayPercent") ?? "").trim();
  const coPayPercent = coPayPercentRaw ? Number(coPayPercentRaw) : null;
  const waitingPeriodMonthsRaw = String(
    formData.get("waitingPeriodMonths") ?? "",
  ).trim();
  const waitingPeriodMonths = waitingPeriodMonthsRaw
    ? Number(waitingPeriodMonthsRaw)
    : null;

  if (!insurer) throw new Error("Enter the insurer");
  if (!policyNumber) throw new Error("Enter the policy number");
  if (!holderName) throw new Error("Enter the policyholder's name");
  if (Number.isNaN(startDate.getTime())) {
    throw new Error("Enter a valid start date");
  }
  if (
    tenureYears != null &&
    (!Number.isInteger(tenureYears) || tenureYears <= 0)
  ) {
    throw new Error("Enter a valid tenure in years");
  }
  if (sumAssured != null && !Number.isFinite(sumAssured)) {
    throw new Error("Enter a valid sum assured");
  }
  if (roomRentLimit != null && !Number.isFinite(roomRentLimit)) {
    throw new Error("Enter a valid room rent limit");
  }
  if (coPayPercent != null && !Number.isFinite(coPayPercent)) {
    throw new Error("Enter a valid co-pay percent");
  }
  if (
    waitingPeriodMonths != null &&
    (!Number.isInteger(waitingPeriodMonths) || waitingPeriodMonths < 0)
  ) {
    throw new Error("Enter a valid waiting period");
  }

  return {
    type,
    insurer,
    policyNumber,
    holderName,
    startDate,
    nominees,
    tenureYears,
    sumAssured,
    roomRentLimit,
    coPayPercent,
    waitingPeriodMonths,
  };
}

/** Creates a new `Policy` for the signed-in owner, defaulting `status` to `ACTIVE`. */
export async function createPolicy(formData: FormData) {
  const session = await requireSession();
  const fields = parsePolicyFields(formData);

  await db.policy.create({
    data: { ownerId: session.user.id, ...fields },
  });

  revalidatePath("/insurance");
  redirect("/insurance");
}

/**
 * Updates every editable field of an existing `Policy` the owner holds,
 * including its `status` (e.g. marking it lapsed, matured or claimed).
 */
export async function updatePolicy(policyId: string, formData: FormData) {
  const session = await requireSession();
  await requireOwnedPolicy(policyId, session.user.id);
  const fields = parsePolicyFields(formData);
  const status = String(formData.get("status")) as PolicyStatus;

  await db.policy.update({
    where: { id: policyId },
    data: { ...fields, status },
  });

  revalidatePath("/insurance");
  redirect("/insurance");
}

/**
 * Soft-deletes a policy — refused if any premium or claim `Bill` has ever
 * been generated for it, since that history needs the policy record to
 * stay meaningful. Same rationale as `deleteLease`.
 */
export async function deletePolicy(policyId: string) {
  const session = await requireSession();
  await requireOwnedPolicy(policyId, session.user.id);

  const existingBill = await db.bill.findFirst({
    where: { policyId },
    select: { id: true },
  });
  if (existingBill) {
    throw new Error(
      "Cannot delete a policy that has premiums or claims on record",
    );
  }

  await db.policy.update({
    where: { id: policyId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/insurance");
  redirect("/insurance");
}
