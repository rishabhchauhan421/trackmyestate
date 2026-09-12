import "server-only";

import { db } from "~/server/db";

/** Investments for the Investments page. */
export async function getInvestments(ownerId: string) {
  return db.investment.findMany({
    where: { ownerId },
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
  return db.investment.findFirst({ where: { id: investmentId, ownerId } });
}
