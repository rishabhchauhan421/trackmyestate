import "server-only";

import { EVENT_CATEGORY_LABELS } from "~/lib/labels";
import { dispatchNotificationJob } from "~/server/notifications/engine";
import { enqueueNotificationJob } from "~/server/notifications/enqueue";
import { normalizeEmail } from "~/server/notifications/suppression";
import type { NotificationJobWithMetadata } from "~/server/notifications/types";
import type { EventCategory } from "../../../generated/prisma";
import { guestOptOutUrl } from "./opt-out";

/**
 * The one message a new guest gets: who added them, what they'll be
 * reminded about, and how to stop — before any reminder arrives.
 *
 * It goes through the notification queue like every other email sent on a
 * user's behalf, so it's logged, retried if Resend fails, checked against
 * the suppression list, and never sent twice to one address for one guest.
 * It's dispatched straight away rather than waiting for the next drain.
 */
export async function sendGuestWelcomeEmail({
  guestId,
  ownerId,
  to,
  guestName,
  ownerName,
  categories,
}: {
  guestId: string;
  ownerId: string;
  to: string;
  guestName: string;
  ownerName: string;
  categories: [EventCategory, ...EventCategory[]];
}) {
  const kinds = categories
    .map((category) => EVENT_CATEGORY_LABELS[category].toLowerCase())
    .join(", ");

  const { job, created } = await enqueueNotificationJob({
    ownerId,
    category: categories[0],
    channel: "EMAIL",
    recipient: to,
    title: `${ownerName} added you to their TrackMyEstate reminders`,
    body: [
      `Hi ${guestName},`,
      `${ownerName} uses TrackMyEstate to keep track of payments and asked us to remind you too — about ${kinds}. Each reminder has just the item, the amount and the due date.`,
      "You don't need an account, and there's nothing to set up.",
      `You're getting this because ${ownerName} added your email address. Ignore it to keep the reminders.`,
    ].join("\n\n"),
    scheduledFor: new Date(),
    metadata: {
      actionUrl: guestOptOutUrl(guestId),
      actionLabel: "Stop these reminders",
      guestId,
      thirdParty: true,
    },
    idempotencyKey: `guest-welcome:${guestId}:${normalizeEmail(to)}`,
  });
  if (!created) return;

  // A failure here is recorded on the job and retried by the drain.
  try {
    await dispatchNotificationJob(job as NotificationJobWithMetadata);
  } catch (error) {
    console.error("Guest welcome email will be retried", error);
  }
}
