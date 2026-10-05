import "server-only";

import { EVENT_CATEGORY_LABELS } from "~/lib/labels";
import {
  renderTransactionalEmail,
  sendTransactionalEmail,
} from "~/server/email/send";
import type { EventCategory } from "../../../generated/prisma";
import { guestOptOutUrl } from "./opt-out";

/**
 * The one message a new guest gets: who added them, what they'll be
 * reminded about, and how to stop — before any reminder arrives.
 */
export async function sendGuestWelcomeEmail({
  guestId,
  to,
  guestName,
  ownerName,
  categories,
}: {
  guestId: string;
  to: string;
  guestName: string;
  ownerName: string;
  categories: EventCategory[];
}) {
  const kinds = categories
    .map((category) => EVENT_CATEGORY_LABELS[category].toLowerCase())
    .join(", ");

  const { html, text } = renderTransactionalEmail({
    heading: `${ownerName} added you to their reminders`,
    paragraphs: [
      `Hi ${guestName},`,
      `${ownerName} uses TrackMyEstate to keep track of payments and asked us to remind you too — about ${kinds}. Each reminder has just the item, the amount and the due date.`,
      "You don't need an account, and there's nothing to set up.",
    ],
    button: { label: "Stop these reminders", url: guestOptOutUrl(guestId) },
    footnote: `You're getting this because ${ownerName} added your email address. Ignore it to keep the reminders.`,
  });

  await sendTransactionalEmail({
    to,
    subject: `${ownerName} added you to their TrackMyEstate reminders`,
    html,
    text,
  });
}
