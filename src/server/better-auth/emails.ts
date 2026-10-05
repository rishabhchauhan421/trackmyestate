/**
 * Transactional emails better-auth asks us to send (see the
 * `emailAndPassword` hooks in `./config.ts`). Sent straight through Resend
 * rather than queued as a `NotificationJob`: these are one-off, time-
 * sensitive links, not reminders.
 */
import "server-only";

import { Resend } from "resend";

import { env } from "~/env";

let client: Resend | undefined;

function getClient() {
  client ??= new Resend(env.RESEND_API_KEY);
  return client;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Emails a password reset link. Without `RESEND_API_KEY` (only allowed
 * outside production — see `~/env`) the link is logged instead, so the flow
 * can be exercised locally.
 */
export async function sendPasswordResetEmail({
  to,
  name,
  url,
}: {
  to: string;
  name: string;
  url: string;
}) {
  if (!env.RESEND_API_KEY) {
    console.info(`[auth] Password reset link for ${to}: ${url}`);
    return;
  }

  const greeting = name ? `Hi ${name},` : "Hi,";
  const intro =
    "We received a request to reset the password for your TrackMyEstate account. This link expires in 1 hour.";
  const outro =
    "If you didn't ask for this, you can ignore this email — your password won't change.";

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
  <p style="font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; color: #6b7280; margin: 0 0 16px;">TrackMyEstate</p>
  <h1 style="font-size: 20px; margin: 0 0 12px;">Reset your password</h1>
  <p style="font-size: 15px; line-height: 1.5; margin: 0 0 12px;">${escapeHtml(greeting)}</p>
  <p style="font-size: 15px; line-height: 1.5; margin: 0 0 24px;">${intro}</p>
  <a href="${escapeHtml(url)}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-size: 14px;">Reset password</a>
  <p style="font-size: 13px; line-height: 1.5; color: #6b7280; margin: 24px 0 0;">${outro}</p>
</div>`.trim();

  const text = `${greeting}\n\n${intro}\n\n${url}\n\n${outro}`;

  const { error } = await getClient().emails.send({
    from: env.NOTIFICATIONS_EMAIL_FROM,
    to,
    subject: "Reset your TrackMyEstate password",
    html,
    text,
  });
  if (error) {
    console.error(
      `[auth] Failed to send password reset email: ${error.message}`,
    );
  }
}
