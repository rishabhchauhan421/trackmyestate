/**
 * The email suppression list: addresses that asked not to be emailed on a
 * user's behalf (see `EmailSuppression` in the schema). The reminder
 * generator leaves them out, and the engine checks again just before
 * sending, so an address that stops emails after a job was queued doesn't
 * get it either.
 */
import "server-only";

import { db } from "~/server/db";

export type SuppressionReason =
  "GUEST_OPT_OUT" | "RECIPIENT_UNSUBSCRIBE" | "ALL_USERS";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function suppressionKey(email: string, ownerId: string | null) {
  return `${ownerId ?? "*"}:${normalizeEmail(email)}`;
}

/**
 * Stops emails to `email` sent on `ownerId`'s behalf, or on anyone's when
 * `ownerId` is null. Doing it twice is harmless.
 */
export async function suppressEmail(
  email: string,
  ownerId: string | null,
  reason: SuppressionReason,
) {
  const key = suppressionKey(email, ownerId);
  await db.emailSuppression.upsert({
    where: { key },
    create: { key, email: normalizeEmail(email), ownerId, reason },
    update: {},
  });
}

/** Which of `emails` (normalized) must not get `ownerId`'s emails. */
export async function suppressedEmails(
  emails: string[],
  ownerId: string,
): Promise<Set<string>> {
  if (emails.length === 0) return new Set();
  const keys = [...new Set(emails.map(normalizeEmail))].flatMap((email) => [
    suppressionKey(email, ownerId),
    suppressionKey(email, null),
  ]);
  const rows = await db.emailSuppression.findMany({
    where: { key: { in: keys } },
    select: { email: true },
  });
  return new Set(rows.map((row) => row.email));
}

export async function isEmailSuppressed(email: string, ownerId: string) {
  return (await suppressedEmails([email], ownerId)).size > 0;
}
