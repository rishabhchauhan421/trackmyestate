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
  // `null` means "no button"; omitted means the app's home page.
  const actionUrl =
    job.metadata?.actionUrl === null
      ? null
      : (job.metadata?.actionUrl ?? env.NEXT_PUBLIC_SITE_URL);
  const actionLabel =
    typeof job.metadata?.actionLabel === "string"
      ? job.metadata.actionLabel
      : "View in TrackMyEstate";
  const secondary =
    actionUrl &&
    typeof job.metadata?.secondaryActionUrl === "string" &&
    typeof job.metadata?.secondaryActionLabel === "string"
      ? {
          url: job.metadata.secondaryActionUrl,
          label: job.metadata.secondaryActionLabel,
        }
      : null;

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
  <p style="font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; color: #6b7280; margin: 0 0 16px;">TrackMyEstate</p>
  <h1 style="font-size: 20px; margin: 0 0 12px;">${escapeHtml(job.title)}</h1>
  <p style="font-size: 15px; line-height: 1.5; margin: 0 0 24px; white-space: pre-line;">${escapeHtml(job.body)}</p>
  ${actionUrl ? `<a href="${escapeHtml(actionUrl)}" style="display: inline-block; background: #0f6e5d; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 14px;">${escapeHtml(actionLabel)}</a>` : ""}
  ${secondary ? `<p style="font-size: 14px; margin: 16px 0 0;"><a href="${escapeHtml(secondary.url)}" style="color: #0f6e5d;">${escapeHtml(secondary.label)}</a></p>` : ""}
</div>`.trim();

  const text = [
    job.title,
    job.body,
    ...(actionUrl ? [`${actionLabel}: ${actionUrl}`] : []),
    ...(secondary ? [`${secondary.label}: ${secondary.url}`] : []),
  ].join("\n\n");

  return { subject: job.title, html, text };
}

/**
 * One email for several reminders to the same person, so a morning with
 * five bills due is one message, not five. Each reminder keeps its own
 * title, first line and (for people with access to the bill) its own
 * "Mark paid" and "View" links. Someone reminded on an owner's behalf gets
 * a single stop link at the end instead.
 */
export function renderDigestEmail(
  jobs: Pick<NotificationJobWithMetadata, "title" | "body" | "metadata">[],
): RenderedEmail {
  const subject = `${jobs.length} reminders: ${jobs[0]!.title} and ${
    jobs.length - 1
  } more`;
  const thirdParty = jobs.some((job) => job.metadata?.thirdParty === true);
  const stopUrl = thirdParty
    ? jobs.map((job) => job.metadata?.actionUrl).find((url) => !!url)
    : undefined;

  const items = jobs.map((job) => {
    const links: { label: string; url: string }[] = [];
    const meta = job.metadata;
    if (!thirdParty && meta) {
      if (typeof meta.actionUrl === "string") {
        links.push({
          label:
            typeof meta.actionLabel === "string"
              ? meta.actionLabel
              : "View in TrackMyEstate",
          url: meta.actionUrl,
        });
      }
      if (
        typeof meta.secondaryActionUrl === "string" &&
        typeof meta.secondaryActionLabel === "string"
      ) {
        links.push({
          label: meta.secondaryActionLabel,
          url: meta.secondaryActionUrl,
        });
      }
    }
    // The first line says what and when; the rest is the same advice on
    // every reminder, said once below.
    const lines = job.body.split("\n");
    const detail = thirdParty ? lines.slice(1).join("\n") : lines[0]!;
    return { title: job.title, detail, links };
  });
  const intro = thirdParty ? jobs[0]!.body.split("\n")[0]! : null;
  const outro = thirdParty
    ? null
    : "Mark each one as settled once it's done, and we'll stop reminding you about it.";

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
  <p style="font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; color: #6b7280; margin: 0 0 16px;">TrackMyEstate</p>
  <h1 style="font-size: 20px; margin: 0 0 12px;">${jobs.length} reminders</h1>
  ${intro ? `<p style="font-size: 15px; line-height: 1.5; margin: 0 0 16px;">${escapeHtml(intro)}</p>` : ""}
  ${items
    .map(
      (item) => `<div style="border-top: 1px solid #e5e7eb; padding: 14px 0;">
    <p style="font-size: 15px; font-weight: 600; margin: 0 0 4px;">${escapeHtml(item.title)}</p>
    <p style="font-size: 14px; line-height: 1.5; color: #4b5563; margin: 0; white-space: pre-line;">${escapeHtml(item.detail)}</p>
    ${item.links.length ? `<p style="font-size: 14px; margin: 8px 0 0;">${item.links.map((link) => `<a href="${escapeHtml(link.url)}" style="color: #0f6e5d; margin-right: 16px;">${escapeHtml(link.label)}</a>`).join("")}</p>` : ""}
  </div>`,
    )
    .join("\n  ")}
  ${outro ? `<p style="font-size: 14px; line-height: 1.5; color: #4b5563; margin: 12px 0 0;">${escapeHtml(outro)}</p>` : ""}
  ${stopUrl ? `<a href="${escapeHtml(stopUrl)}" style="display: inline-block; margin-top: 12px; background: #0f6e5d; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 8px; font-size: 14px;">Stop these reminders</a>` : ""}
</div>`.trim();

  const text = [
    `${jobs.length} reminders`,
    ...(intro ? [intro] : []),
    ...items.map((item) =>
      [
        item.title,
        item.detail,
        ...item.links.map((link) => `${link.label}: ${link.url}`),
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    ...(outro ? [outro] : []),
    ...(stopUrl ? [`Stop these reminders: ${stopUrl}`] : []),
  ].join("\n\n");

  return { subject, html, text };
}
