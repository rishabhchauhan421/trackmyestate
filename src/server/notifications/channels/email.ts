/**
 * Phase 1's only live channel. Sends via Resend — see
 * `~/server/notifications/registry` for how this is wired to `EMAIL` jobs.
 */
import "server-only";

import { createHash } from "node:crypto";

import { Resend } from "resend";

import { env } from "~/env";
import {
  renderDigestEmail,
  renderNotificationEmail,
  type RenderedEmail,
} from "../templates";
import type {
  ChannelDigestSender,
  ChannelSendResult,
  ChannelSender,
} from "../types";

let client: Resend | undefined;

function getClient() {
  client ??= new Resend(env.RESEND_API_KEY);
  return client;
}

/**
 * Sends one email. `idempotencyKey` makes a repeat of the same send (a run
 * that died after Resend accepted the email but before the job was marked
 * sent) a no-op on Resend's side instead of a second email.
 */
async function deliver(
  to: string,
  { subject, html, text }: RenderedEmail,
  idempotencyKey: string,
): Promise<ChannelSendResult> {
  if (!env.RESEND_API_KEY) {
    return {
      ok: false,
      retryable: false,
      reason: "RESEND_API_KEY is not configured",
    };
  }

  const { data, error } = await getClient().emails.send(
    { from: env.NOTIFICATIONS_EMAIL_FROM, to, subject, html, text },
    { idempotencyKey },
  );

  if (error) {
    // Resend's 4xx errors (bad address, unverified domain, ...) won't
    // succeed on retry; 429 (rate limit), 5xx and unknown-status errors
    // might.
    const rateLimited = error.statusCode === 429;
    const retryable =
      error.statusCode === null || rateLimited || error.statusCode >= 500;
    return { ok: false, retryable, reason: error.message, rateLimited };
  }

  return { ok: true, providerMessageId: data?.id };
}

export const sendEmail: ChannelSender = (job) =>
  deliver(
    job.recipient,
    renderNotificationEmail(job),
    `notification-job/${job.id}`,
  );

/** One email for several of a recipient's reminders (see `templates`). */
export const sendEmailDigest: ChannelDigestSender = (jobs) => {
  const ids = jobs.map((job) => job.id).sort();
  const key = createHash("sha256").update(ids.join(",")).digest("hex");
  return deliver(
    jobs[0]!.recipient,
    renderDigestEmail(jobs),
    `notification-digest/${key}`,
  );
};
