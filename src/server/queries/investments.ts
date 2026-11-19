import "server-only";

import { db } from "~/server/db";
import { hasPaymentHistory } from "~/server/schedules/lifecycle";
import { NOT_SOFT_DELETED } from "~/server/queries/shared";

/**
 * Investments for the Investments page. Deleted investments (see
 * `deleteInvestment` in `~/server/actions/investments`) are excluded.
 */
export async function getInvestments(householdId: string) {
  return db.investment.findMany({
    where: { householdId, ...NOT_SOFT_DELETED },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * A single `Investment`, scoped to `householdId` — for the edit page. Returns
 * `null` for a nonexistent investment *or* one owned by someone else, same
 * rationale as `getPropertyForHousehold`.
 */
export async function getInvestmentForHousehold(
  investmentId: string,
  householdId: string,
) {
  return db.investment.findFirst({
    where: { id: investmentId, householdId, ...NOT_SOFT_DELETED },
  });
}

/**
 * Whether money has been recorded against any of this investment's bills
 * (a return or payout). Such a investment can't be deleted — see `deleteInvestment` in
 * `~/server/actions/investments` — because that history needs it; unpaid bills
 * are removed along with it instead.
 */
export async function hasPaymentsForInvestment(investmentId: string) {
  return hasPaymentHistory(db, { investmentId: investmentId });
}
