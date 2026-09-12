import "server-only";

import { db } from "~/server/db";
import { NOT_SOFT_DELETED, OPEN_PAYMENT_STATUSES } from "~/server/queries/shared";

/**
 * Policies for the Insurance page, each with its next open premium `Bill`,
 * if any. Batch-fetched and grouped in application code — same rationale as
 * `getProperties`. Deleted policies (see `deletePolicy` in
 * `~/server/actions/policies`) are excluded.
 */
export async function getPolicies(ownerId: string) {
  const policies = await db.policy.findMany({
    where: { ownerId, ...NOT_SOFT_DELETED },
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
 * A single `Policy`, scoped to `ownerId` — for the edit page. Returns
 * `null` for a nonexistent policy *or* one owned by someone else, same
 * rationale as `getPropertyForOwner`.
 */
export async function getPolicyForOwner(policyId: string, ownerId: string) {
  return db.policy.findFirst({
    where: { id: policyId, ownerId, ...NOT_SOFT_DELETED },
  });
}

/**
 * Whether any `Bill` has ever been generated for this policy (a premium or
 * claim settlement on record). A policy with billing history can't be
 * deleted — see `deletePolicy` in `~/server/actions/policies` — same
 * rationale as `hasBillsForLease`.
 */
export async function hasBillsForPolicy(policyId: string) {
  const bill = await db.bill.findFirst({
    where: { policyId },
    select: { id: true },
  });
  return bill != null;
}
