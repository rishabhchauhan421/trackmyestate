/**
 * Shared types for the notification engine (`~/server/notifications`). A
 * "channel" is anything that can deliver a `NotificationJob` — email today,
 * WhatsApp/SMS/push once their providers are wired up (see
 * `channels/whatsapp.ts`, `channels/sms.ts`, `channels/push.ts`).
 */
import type { NotificationJob } from "../../../generated/prisma";

/** Structured `metadata` a job may carry, read by channel senders/templates. */
export interface NotificationJobMetadata {
  /** Deep link into the app for this job's underlying entity, if any. */
  actionUrl?: string;
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
