"use server";

/**
 * The public "stop these reminders" action behind the link in every guest
 * email. Guests have no account, so the signed link is the authorisation
 * (see `~/server/guests/opt-out`).
 */

import { redirect } from "next/navigation";

import { db } from "~/server/db";
import { verifyGuestOptOut } from "~/server/guests/opt-out";

export async function stopGuestReminders(guestId: string, signature: string) {
  if (!verifyGuestOptOut(guestId, signature)) {
    throw new Error("This link isn't valid");
  }

  // "Not opted out yet" must match a missing `optedOutAt` too: guests are
  // created without it, and in MongoDB a plain `null` filter doesn't match
  // a missing field (same reason as `NOT_SOFT_DELETED`).
  await db.guest.updateMany({
    where: {
      id: guestId,
      OR: [{ optedOutAt: null }, { optedOutAt: { isSet: false } }],
    },
    data: { optedOutAt: new Date() },
  });

  const params = new URLSearchParams({ guest: guestId, sig: signature });
  redirect(`/reminders/stop?${params.toString()}&done=1`);
}
