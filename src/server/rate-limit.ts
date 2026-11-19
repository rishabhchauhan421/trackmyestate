/**
 * Attempt limits for the auth Server Actions (sign-in, sign-up, password
 * reset, resending the verification email). better-auth's own limiter only
 * covers its `/api/auth/*` HTTP endpoints, not `auth.api.*` calls made from
 * Server Actions, so these actions count attempts here.
 *
 * Counts live in MongoDB (`AuthThrottle`), not in memory, because every
 * serverless instance has its own memory. Each key is a fixed window: the
 * first attempt opens it, and it resets once `windowMs` has passed.
 */
import "server-only";

import { headers } from "next/headers";

import { db } from "~/server/db";

export interface RateLimitRule {
  /** Attempts allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** Limits per action, keyed by the client's IP and by the email entered. */
export const AUTH_LIMITS = {
  signIn: {
    ip: { limit: 30, windowMs: 15 * MINUTE },
    email: { limit: 10, windowMs: 15 * MINUTE },
  },
  signUp: {
    ip: { limit: 10, windowMs: HOUR },
    email: { limit: 3, windowMs: HOUR },
  },
  passwordReset: {
    ip: { limit: 10, windowMs: HOUR },
    email: { limit: 3, windowMs: HOUR },
  },
  verificationEmail: {
    ip: { limit: 10, windowMs: HOUR },
    email: { limit: 3, windowMs: HOUR },
  },
} satisfies Record<string, { ip: RateLimitRule; email: RateLimitRule }>;

export type AuthAction = keyof typeof AUTH_LIMITS;

export const RATE_LIMITED_MESSAGE =
  "Too many attempts. Please wait a few minutes and try again.";

function isUniqueConstraintError(err: unknown) {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: unknown }).code === "P2002"
  );
}

/**
 * Counts one attempt against `key` and says whether it's within `rule`.
 * Attempts over the limit still count, so hammering doesn't reopen the
 * window early.
 */
export async function consumeAttempt(
  key: string,
  rule: RateLimitRule,
  now = new Date(),
): Promise<boolean> {
  const windowOpenedAfter = new Date(now.getTime() - rule.windowMs);

  // An open window: count the attempt atomically.
  const counted = await db.authThrottle.updateMany({
    where: { key, windowStart: { gt: windowOpenedAfter } },
    data: { count: { increment: 1 } },
  });
  if (counted.count > 0) {
    const row = await db.authThrottle.findUnique({
      where: { key },
      select: { count: true },
    });
    return (row?.count ?? 0) <= rule.limit;
  }

  // No window yet, or it expired: open a new one.
  try {
    await db.authThrottle.upsert({
      where: { key },
      create: { key, count: 1, windowStart: now },
      update: { count: 1, windowStart: now },
    });
  } catch (err) {
    // Another request created the row first; count against it instead.
    if (isUniqueConstraintError(err)) return consumeAttempt(key, rule, now);
    throw err;
  }
  return 1 <= rule.limit;
}

/** The client's IP, as the hosting proxy reports it. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded ?? h.get("x-real-ip")?.trim() ?? "unknown";
}

/**
 * Counts an attempt at `action` by this client (and for `email`, when the
 * form has one) and says whether it may go ahead. Both counters move on
 * every attempt so a blocked IP can't keep probing one email, and vice versa.
 */
export async function allowAuthAttempt(
  action: AuthAction,
  email?: string,
): Promise<boolean> {
  const rules = AUTH_LIMITS[action];
  const ip = await clientIp();
  const checks = [consumeAttempt(`${action}:ip:${ip}`, rules.ip)];
  if (email) {
    checks.push(
      consumeAttempt(`${action}:email:${email.toLowerCase()}`, rules.email),
    );
  }
  const results = await Promise.all(checks);
  return results.every(Boolean);
}
