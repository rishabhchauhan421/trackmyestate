import "server-only";

import { Resend } from "resend";

import { env } from "~/env";

/**
 * One-off transactional emails (password reset, guest welcome) sent
 * straight through Resend — not reminders, which go through the
 * `NotificationJob` queue. Without `RESEND_API_KEY` (allowed outside
 * production, see ~/env) the email is logged instead, so flows can be
 * exercised locally.
 */

let client: Resend | undefined;

function getClient() {
  client ??= new Resend(env.RESEND_API_KEY);
  return client;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Returns false (and logs) if sending failed; never throws. */
export async function sendTransactionalEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  if (!env.RESEND_API_KEY) {
    console.info(`[email] To ${to}: ${subject}\n${text}`);
    return true;
  }
  const { error } = await getClient().emails.send({
    from: env.NOTIFICATIONS_EMAIL_FROM,
    to,
    subject,
    html,
    text,
  });
  if (error) {
    console.error(`[email] Failed to send "${subject}": ${error.message}`);
    return false;
  }
  return true;
}

/** The shared look for transactional emails: heading, paragraphs, button. */
export function renderTransactionalEmail({
  heading,
  paragraphs,
  button,
  footnote,
}: {
  heading: string;
  paragraphs: string[];
  button?: { label: string; url: string };
  footnote?: string;
}) {
  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; color: #12201c;">
  <p style="font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; color: #5a6762; margin: 0 0 16px;">TrackMyEstate</p>
  <h1 style="font-size: 20px; margin: 0 0 12px;">${escapeHtml(heading)}</h1>
  ${paragraphs.map((p) => `<p style="font-size: 15px; line-height: 1.5; margin: 0 0 12px;">${escapeHtml(p)}</p>`).join("\n  ")}
  ${button ? `<a href="${escapeHtml(button.url)}" style="display: inline-block; margin-top: 12px; background: #0f6e5d; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 14px;">${escapeHtml(button.label)}</a>` : ""}
  ${footnote ? `<p style="font-size: 13px; line-height: 1.5; color: #5a6762; margin: 24px 0 0;">${escapeHtml(footnote)}</p>` : ""}
</div>`.trim();

  const text = [
    heading,
    ...paragraphs,
    ...(button ? [`${button.label}: ${button.url}`] : []),
    ...(footnote ? [footnote] : []),
  ].join("\n\n");

  return { html, text };
}
