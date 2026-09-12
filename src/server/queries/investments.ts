import "server-only";

import { db } from "~/server/db";
import { NOT_SOFT_DELETED } from "~/server/queries/shared";

/**
 * Investments for the Investments page. Deleted investments (see
 * `deleteInvestment` in `~/server/actions/investments`) are excluded.
 */
export async function getInvestments(ownerId: string) {
  return db.investment.findMany({
    where: { ownerId, ...NOT_SOFT_DELETED },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * A single `Investment`, scoped to `ownerId` — for the edit page. Returns
 * `null` for a nonexistent investment *or* one owned by someone else, same
 * rationale as `getPropertyForOwner`.
 */
export async function getInvestmentForOwner(
  investmentId: string,
  ownerId: string,
) {
  return db.investment.findFirst({
    where: { id: investmentId, ownerId, ...NOT_SOFT_DELETED },
  });
}

/**
 * Whether any `Bill` has ever been generated for this investment (e.g. a
 * payout or investment-return event). An investment with billing history
 * can't be deleted — see `deleteInvestment` in
 * `~/server/actions/investments` — same rationale as `hasBillsForLease`.
 */
export async function hasBillsForInvestment(investmentId: string) {
  const bill = await db.bill.findFirst({
    where: { investmentId },
    select: { id: true },
  });
  return bill != null;
}
