import "server-only";

import { db } from "~/server/db";
import { OPEN_PAYMENT_STATUSES } from "~/server/queries/shared";

/**
 * Policies for the Insurance page, each with its next open premium `Bill`,
 * if any. Batch-fetched and grouped in application code — same rationale as
 * `getProperties`.
 */
export async function getPolicies(ownerId: string) {
  const policies = await db.policy.findMany({
    where: { ownerId },
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
