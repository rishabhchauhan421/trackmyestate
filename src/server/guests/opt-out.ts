import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "~/env";

/**
 * Signed "stop these reminders" links for people emailed on a user's
 * behalf. They have no account, so the link itself is the proof: an HMAC
 * of the guest's id (for a guest), or of the sending user and the address
 * (for a utility recipient), which can't be forged for anyone else.
 */

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function matches(expected: string, signature: string) {
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

function secret() {
  // BETTER_AUTH_SECRET is required in production (see ~/env); the fallback
  // only keeps local development working without one.
  return env.BETTER_AUTH_SECRET ?? "dev-only-guest-opt-out-secret";
}

export function signGuestOptOut(guestId: string) {
  return sign(`guest-opt-out:${guestId}`);
}

export function verifyGuestOptOut(guestId: string, signature: string) {
  return matches(signGuestOptOut(guestId), signature);
}

export function signRecipientOptOut(ownerId: string, email: string) {
  return sign(`recipient-opt-out:${ownerId}:${email.trim().toLowerCase()}`);
}

export function verifyRecipientOptOut(
  ownerId: string,
  email: string,
  signature: string,
) {
  return matches(signRecipientOptOut(ownerId, email), signature);
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
