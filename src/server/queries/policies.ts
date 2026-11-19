import "server-only";

import type { PremiumFrequency } from "../../../generated/prisma";

import { db } from "~/server/db";
import { hasPaymentHistory } from "~/server/schedules/lifecycle";
import {
  NOT_SOFT_DELETED,
  OPEN_PAYMENT_STATUSES,
} from "~/server/queries/shared";

/**
 * Policies for the Insurance page, each with its next open premium `Bill`,
 * if any. Batch-fetched and grouped in application code — same rationale as
 * `getProperties`. Deleted policies (see `deletePolicy` in
 * `~/server/actions/policies`) are excluded.
 */
export async function getPolicies(householdId: string) {
  const policies = await db.policy.findMany({
    where: { householdId, ...NOT_SOFT_DELETED },
    orderBy: { createdAt: "asc" },
  });

  const policyIds = policies.map((policy) => policy.id);
  const openPremiums = policyIds.length
    ? await db.bill.findMany({
        where: {
          category: "PREMIUM",
          policyId: { in: policyIds },
          status: { in: [...OPEN_PAYMENT_STATUSES] },
        },
        orderBy: { dueDate: "asc" },
      })
    : [];

  const nextPremiumByPolicy = new Map<string, (typeof openPremiums)[number]>();
  for (const bill of openPremiums) {
    if (!nextPremiumByPolicy.has(bill.policyId!)) {
      nextPremiumByPolicy.set(bill.policyId!, bill);
    }
  }

  return policies.map((policy) => ({
    ...policy,
    nextPremium: nextPremiumByPolicy.get(policy.id) ?? null,
  }));
}

/**
 * A single `Policy`, scoped to `householdId` — for the edit page. Returns
 * `null` for a nonexistent policy *or* one owned by someone else, same
 * rationale as `getPropertyForHousehold`.
 */
export async function getPolicyForHousehold(
  policyId: string,
  householdId: string,
) {
  return db.policy.findFirst({
    where: { id: policyId, householdId, ...NOT_SOFT_DELETED },
  });
}

/**
 * Whether money has been recorded against any of this policy's bills
 * (a premium, payout or claim). Such a policy can't be deleted — see `deletePolicy` in
 * `~/server/actions/policies` — because that history needs it; unpaid bills
 * are removed along with it instead.
 */
export async function hasPaymentsForPolicy(policyId: string) {
  return hasPaymentHistory(db, { policyId: policyId });
}

/** A policy's premium and payout, for the edit form (amounts in paise). */
export interface PolicyPaymentDefaults {
  premiumAmount: number | null;
  premiumFrequency: PremiumFrequency | null;
  premiumDueDate: Date | null;
  payoutAmount: number | null;
  payoutDate: Date | null;
}

/**
 * The policy's current premium and payout (from its active PREMIUM and
 * PAYOUT schedules), as the edit form's starting values. A yearly
 * schedule capped at one occurrence is a one-time premium.
 */
export async function getPolicyPaymentDefaults(
  policyId: string,
): Promise<PolicyPaymentDefaults> {
  const schedules = await db.billSchedule.findMany({
    where: {
      policyId,
      category: { in: ["PREMIUM", "PAYOUT"] },
      active: true,
    },
  });
  const premium = schedules.find((s) => s.category === "PREMIUM");
  const payout = schedules.find((s) => s.category === "PAYOUT");

  let premiumFrequency: PremiumFrequency | null = null;
  if (premium) {
    premiumFrequency =
      premium.recurrence === "YEARLY" && premium.tenureMonths === 12
        ? "SINGLE"
        : premium.recurrence === "MONTHLY" ||
            premium.recurrence === "QUARTERLY" ||
            premium.recurrence === "HALF_YEARLY" ||
            premium.recurrence === "YEARLY"
          ? premium.recurrence
          : null;
  }

  return {
    premiumAmount: premium?.defaultAmount ?? null,
    premiumFrequency,
    premiumDueDate: premium?.startDate ?? null,
    payoutAmount: payout?.defaultAmount ?? null,
    payoutDate: payout?.startDate ?? null,
  };
}
