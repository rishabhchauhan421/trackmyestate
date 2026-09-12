/**
 * Phase 1's only live channel. Sends via Resend — see
 * `~/server/notifications/registry` for how this is wired to `EMAIL` jobs.
 */
import "server-only";

import { Resend } from "resend";

import { env } from "~/env";
import { renderNotificationEmail } from "../templates";
import type { ChannelSender } from "../types";

let client: Resend | undefined;

function getClient() {
  client ??= new Resend(env.RESEND_API_KEY);
  return client;
}

export const sendEmail: ChannelSender = async (job) => {
  if (!env.RESEND_API_KEY) {
    return {
      ok: false,
      retryable: false,
      reason: "RESEND_API_KEY is not configured",
    };
  }

  const { subject, html, text } = renderNotificationEmail(job);

  const { data, error } = await getClient().emails.send({
    from: env.NOTIFICATIONS_EMAIL_FROM,
    to: job.recipient,
    subject,
    html,
    text,
  });

  if (error) {
    // Resend's 4xx errors (bad address, unverified domain, ...) won't
    // succeed on retry; 429 (rate limit), 5xx and unknown-status errors
    // might.
    const retryable =
      error.statusCode === null ||
      error.statusCode === 429 ||
      error.statusCode >= 500;
    return { ok: false, retryable, reason: error.message };
  }

  return { ok: true, providerMessageId: data?.id };
};
