import "server-only";

import { env } from "~/env";
import { signPayload as sign, verifyPayload } from "~/server/signed-link";

/**
 * Signed "stop these reminders" links for people emailed on a user's
 * behalf. They have no account, so the link itself is the proof: a
 * signature (see `~/server/signed-link`) of the guest's id (for a guest),
 * or of the sending user and the address (for a utility recipient), which
 * can't be forged for anyone else.
 */

export function signGuestOptOut(guestId: string) {
  return sign(`guest-opt-out:${guestId}`);
}

export function verifyGuestOptOut(guestId: string, signature: string) {
  return verifyPayload(`guest-opt-out:${guestId}`, signature);
}

export function signRecipientOptOut(ownerId: string, email: string) {
  return sign(`recipient-opt-out:${ownerId}:${email.trim().toLowerCase()}`);
}

export function verifyRecipientOptOut(
  ownerId: string,
  email: string,
  signature: string,
) {
  return verifyPayload(
    `recipient-opt-out:${ownerId}:${email.trim().toLowerCase()}`,
    signature,
  );
}

/** The full link included in every email a guest receives. */
export function guestOptOutUrl(guestId: string) {
  const params = new URLSearchParams({
    guest: guestId,
    sig: signGuestOptOut(guestId),
  });
  return `${env.NEXT_PUBLIC_SITE_URL}/reminders/stop?${params.toString()}`;
}

/** The link in every reminder a utility's recipient gets. */
export function recipientOptOutUrl(ownerId: string, email: string) {
  const params = new URLSearchParams({
    owner: ownerId,
    email: email.trim().toLowerCase(),
    sig: signRecipientOptOut(ownerId, email),
  });
  return `${env.NEXT_PUBLIC_SITE_URL}/reminders/stop?${params.toString()}`;
}
