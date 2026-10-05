import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "~/env";

/**
 * Signed "stop these reminders" links for guests. Guests have no account,
 * so the link itself is the proof: an HMAC of the guest's id, which can't
 * be forged for someone else's guest record.
 */

function secret() {
  // BETTER_AUTH_SECRET is required in production (see ~/env); the fallback
  // only keeps local development working without one.
  return env.BETTER_AUTH_SECRET ?? "dev-only-guest-opt-out-secret";
}

export function signGuestOptOut(guestId: string) {
  return createHmac("sha256", secret())
    .update(`guest-opt-out:${guestId}`)
    .digest("base64url");
}

export function verifyGuestOptOut(guestId: string, signature: string) {
  const expected = Buffer.from(signGuestOptOut(guestId));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** The full link included in every email a guest receives. */
export function guestOptOutUrl(guestId: string) {
  const params = new URLSearchParams({
    guest: guestId,
    sig: signGuestOptOut(guestId),
  });
  return `${env.NEXT_PUBLIC_SITE_URL}/reminders/stop?${params.toString()}`;
}
