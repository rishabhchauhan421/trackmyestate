"use server";

/**
 * The public "stop these reminders" action behind the link in every email
 * sent on a user's behalf (to a guest, or to a utility's recipient). Those
 * people have no account, so the signed link is the authorisation (see
 * `~/server/guests/opt-out`).
 *
 * Stopping adds the address to the suppression list, so it holds even if
 * the guest is deleted and added again, or the address is added to another
 * utility. With `everyone`, no TrackMyEstate user can email it again.
 */

import { redirect } from "next/navigation";

import { db } from "~/server/db";
import {
  verifyGuestOptOut,
  verifyRecipientOptOut,
} from "~/server/guests/opt-out";
import { suppressEmail } from "~/server/notifications/suppression";

export type StopLink =
  | { guest: string; sig: string }
  | { owner: string; email: string; sig: string };

export async function stopReminders(link: StopLink, everyone: boolean) {
  let email: string | null;
  let ownerId: string;

  if ("guest" in link) {
    if (!verifyGuestOptOut(link.guest, link.sig)) {
      throw new Error("This link isn't valid");
    }
    const guest = await db.guest.findUnique({
      where: { id: link.guest },
      select: { email: true, ownerId: true },
    });
    if (!guest) throw new Error("This link isn't valid");
    email = guest.email;
    ownerId = guest.ownerId;

    // "Not opted out yet" must match a missing `optedOutAt` too: guests are
    // created without it, and in MongoDB a plain `null` filter doesn't
    // match a missing field (same reason as `NOT_SOFT_DELETED`).
    await db.guest.updateMany({
      where: {
        id: link.guest,
        OR: [{ optedOutAt: null }, { optedOutAt: { isSet: false } }],
      },
      data: { optedOutAt: new Date() },
    });
  } else {
    if (!verifyRecipientOptOut(link.owner, link.email, link.sig)) {
      throw new Error("This link isn't valid");
    }
    email = link.email;
    ownerId = link.owner;
  }

  if (email) {
    await suppressEmail(
      email,
      ownerId,
      "guest" in link ? "GUEST_OPT_OUT" : "RECIPIENT_UNSUBSCRIBE",
    );
    if (everyone) await suppressEmail(email, null, "ALL_USERS");
  }

  const params = new URLSearchParams(link);
  params.set("done", everyone ? "all" : "1");
  redirect(`/reminders/stop?${params.toString()}`);
}
