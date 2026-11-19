import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "~/env";

/**
 * Signatures for links emailed to people who may not be signed in (or have
 * no account at all): the link carries an HMAC of what it acts on, which
 * can't be forged for anything else. Start each payload with what the link
 * is for (`"bill-paid:…"`), so a signature for one kind of link is never
 * valid for another.
 */

function secret() {
  // BETTER_AUTH_SECRET is required in production (see ~/env); the fallback
  // only keeps local development working without one.
  return env.BETTER_AUTH_SECRET ?? "dev-only-guest-opt-out-secret";
}

export function signPayload(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function verifyPayload(payload: string, signature: string) {
  const a = Buffer.from(signPayload(payload));
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
