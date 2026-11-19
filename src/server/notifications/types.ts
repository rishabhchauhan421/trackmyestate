/**
 * Shared types for the notification engine (`~/server/notifications`). A
 * "channel" is anything that can deliver a `NotificationJob` — email today,
 * WhatsApp/SMS/push once their providers are wired up (see
 * `channels/whatsapp.ts`, `channels/sms.ts`, `channels/push.ts`).
 */
import type { NotificationJob } from "../../../generated/prisma";

/** Structured `metadata` a job may carry, read by channel senders/templates. */
export interface NotificationJobMetadata {
  /**
   * Where the email's button goes. Omitted = the app's home page; `null` =
   * no button (for recipients without an account).
   */
  actionUrl?: string | null;
  /** Button text for `actionUrl`; defaults to "View in TrackMyEstate". */
  actionLabel?: string;
  /**
   * A second, plain link under the button (e.g. "View in TrackMyEstate"
   * beside a "Mark paid" button). Shown only when there is a button.
   */
  secondaryActionUrl?: string;
  /** Link text for `secondaryActionUrl`. */
  secondaryActionLabel?: string;
  /** Set on a guest's reminder, so it can be cancelled if they stop. */
  guestId?: string;
  /**
   * Sent on the owner's behalf to someone else (a guest, a utility's
   * recipient): checked against the suppression list before sending.
   */
  thirdParty?: boolean;
  [key: string]: unknown;
}

export type NotificationJobWithMetadata = Omit<NotificationJob, "metadata"> & {
  metadata: NotificationJobMetadata | null;
};

/** Outcome of a channel attempting to deliver one job. */
export type ChannelSendResult =
  | { ok: true; providerMessageId?: string }
  | { ok: false; retryable: boolean; reason: string };

export type ChannelSender = (
  job: NotificationJobWithMetadata,
) => Promise<ChannelSendResult>;

/**
 * Thrown by a not-yet-built channel (WhatsApp, SMS, push in phase 1). The
 * engine catches this specifically and marks the job `SKIPPED` rather than
 * `FAILED` — the job wasn't attempted and isn't worth retrying, as opposed
 * to a provider call that failed.
 */
export class NotImplementedChannelError extends Error {
  constructor(channel: string) {
    super(`The "${channel}" notification channel is not yet implemented`);
    this.name = "NotImplementedChannelError";
  }
}
