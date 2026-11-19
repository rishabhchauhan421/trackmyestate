import "server-only";

import { FormError } from "~/lib/form";
import { db } from "~/server/db";
import { isEmailSuppressed } from "~/server/notifications/suppression";
import { NOT_SOFT_DELETED } from "~/server/queries/shared";
import { consumeAttempt } from "~/server/rate-limit";

/**
 * Limits on emailing people who never signed up, so the app can't be used
 * to send mail to arbitrary addresses: a cap on guests per user, a cap on
 * welcome emails per user per day, and nobody who asked not to be emailed.
 */

/** Guests one user can have at a time. */
export const MAX_GUESTS = 25;

/** New guest email addresses one user can add per day. */
export const DAILY_GUEST_INVITES = { limit: 10, windowMs: 24 * 60 * 60 * 1000 };

/** Throws a `FormError` if `ownerId` can't add another guest now. */
export async function checkGuestCapacity(ownerId: string) {
  const guests = await db.guest.count({
    where: { ownerId, ...NOT_SOFT_DELETED },
  });
  if (guests >= MAX_GUESTS) {
    throw new FormError(
      `You can have up to ${MAX_GUESTS} guests. Remove one to add another.`,
    );
  }
}

/**
 * Throws a `FormError` if `ownerId` may not start emailing `email`: the
 * address unsubscribed, or the daily invite limit is used up. Counts one
 * invite when allowed.
 */
export async function claimGuestInvite(ownerId: string, email: string) {
  if (await isEmailSuppressed(email, ownerId)) {
    throw new FormError(
      "This person asked not to get reminders from you, so we can't email them.",
      "email",
    );
  }
  if (!(await consumeAttempt(`guest-invite:${ownerId}`, DAILY_GUEST_INVITES))) {
    throw new FormError(
      "You've added a lot of guests today. Please try again tomorrow.",
    );
  }
}
