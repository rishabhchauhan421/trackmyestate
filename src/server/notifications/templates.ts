/**
 * Renders a `NotificationJob`'s plain `title`/`body` into the shapes each
 * channel needs. Jobs carry plain text because the caller that enqueues
 * them (a `NotificationRule` evaluation, a one-off reminder, ...) shouldn't
 * need to know about any particular channel's markup — that's this file's
 * job.
 */
import { env } from "~/env";
import type { NotificationJobWithMetadata } from "./types";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Escapes text pulled from job content before it's interpolated into HTML. */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderNotificationEmail(
  job: Pick<NotificationJobWithMetadata, "title" | "body" | "metadata">,
): RenderedEmail {
  const actionUrl = job.metadata?.actionUrl ?? env.NEXT_PUBLIC_SITE_URL;

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
  <p style="font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; color: #6b7280; margin: 0 0 16px;">TrackMyEstate</p>
  <h1 style="font-size: 20px; margin: 0 0 12px;">${escapeHtml(job.title)}</h1>
  <p style="font-size: 15px; line-height: 1.5; margin: 0 0 24px; white-space: pre-line;">${escapeHtml(job.body)}</p>
  <a href="${escapeHtml(actionUrl)}" style="display: inline-block; background: #111827; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-size: 14px;">View in TrackMyEstate</a>
</div>`.trim();

  const text = `${job.title}\n\n${job.body}\n\n${actionUrl}`;

  return { subject: job.title, html, text };
}
