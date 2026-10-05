import "server-only";

import { db } from "~/server/db";
import { NOT_SOFT_DELETED } from "~/server/queries/shared";

/** An owner's guests, oldest first. */
export async function getGuests(ownerId: string) {
  return db.guest.findMany({
    where: { ownerId, ...NOT_SOFT_DELETED },
    orderBy: { createdAt: "asc" },
  });
}

/** One guest, scoped to its owner (null for someone else's or a missing one). */
export async function getGuestForOwner(guestId: string, ownerId: string) {
  return db.guest.findFirst({
    where: { id: guestId, ownerId, ...NOT_SOFT_DELETED },
  });
}
