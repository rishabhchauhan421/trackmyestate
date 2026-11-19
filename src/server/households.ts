/**
 * Households own portfolios. Every asset record carries a `householdId`, and
 * every read and write is scoped to the signed-in user's household rather
 * than to the user themselves, so a portfolio can later be shared with a
 * spouse or an advisor without touching each query again.
 *
 * Each user gets a personal household the first time they need one. Creating
 * it also backfills `householdId` onto any records they saved before
 * households existed, so no deploy-time migration step is required for this.
 */
import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";

/** The signed-in user and the household their data lives in. */
export interface Scope {
  userId: string;
  householdId: string;
  user: { id: string; name: string; email: string };
}

const NO_HOUSEHOLD = {
  OR: [{ householdId: null }, { householdId: { isSet: false } }],
};

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/** Points every record `userId` created before households at `householdId`. */
async function backfillHousehold(userId: string, householdId: string) {
  const where = { ownerId: userId, ...NO_HOUSEHOLD };
  const data = { householdId };
  await Promise.all([
    db.property.updateMany({ where, data }),
    db.policy.updateMany({ where, data }),
    db.investment.updateMany({ where, data }),
    db.loan.updateMany({ where, data }),
    db.billSchedule.updateMany({ where, data }),
    db.bill.updateMany({ where, data }),
    db.document.updateMany({ where, data }),
    db.paymentTransaction.updateMany({ where, data }),
  ]);
}

/**
 * The id of `user`'s household: the first one they belong to, or a new
 * personal household (with their older records moved into it).
 */
export async function ensureHousehold(user: {
  id: string;
  name: string;
}): Promise<string> {
  const membership = await db.householdMember.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { householdId: true },
  });
  if (membership) return membership.householdId;

  let householdId: string;
  try {
    const household = await db.household.create({
      data: {
        name: user.name ? `${user.name}'s household` : "My household",
        personalForUserId: user.id,
        members: { create: { userId: user.id, role: "OWNER" } },
      },
    });
    householdId = household.id;
  } catch (error) {
    // Another request created it first: use that one.
    if (!isUniqueConstraintError(error)) throw error;
    const existing = await db.household.findUnique({
      where: { personalForUserId: user.id },
      select: { id: true },
    });
    if (!existing) throw error;
    householdId = existing.id;
  }

  await backfillHousehold(user.id, householdId);
  return householdId;
}

/**
 * The signed-in user's scope, or a redirect to sign in. Cached per request,
 * so pages and actions can call it freely.
 */
export const requireScope = cache(async (): Promise<Scope> => {
  const session = await getSession();
  if (!session) redirect("/login");
  const householdId = await ensureHousehold(session.user);
  return {
    userId: session.user.id,
    householdId,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    },
  };
});
