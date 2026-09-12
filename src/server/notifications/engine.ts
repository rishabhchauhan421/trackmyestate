/**
 * Dispatches one `NotificationJob` to its channel and records the outcome.
 * The other half of the engine — picking which due jobs to dispatch — is
 * `processDueNotificationJobs` in `./process`.
 */
import "server-only";

import { db } from "~/server/db";
import { CHANNEL_SENDERS } from "./registry";
import { NotImplementedChannelError } from "./types";
import type { NotificationJobWithMetadata } from "./types";

/** Retryable failures get this many attempts (the original send + retries) before giving up. */
export const MAX_SEND_ATTEMPTS = 3;

export type DispatchOutcome =
  | "SENT"
  | "SKIPPED"
  | "RETRY_SCHEDULED"
  | "FAILED"
  | "ALREADY_CLAIMED";

/**
 * Claims `job` (SCHEDULED -> PROCESSING, so two overlapping cron runs can't
 * both send it), sends it, and writes the result back. Returns without
 * sending if another run already claimed it first.
 */
export async function dispatchNotificationJob(
  job: NotificationJobWithMetadata,
): Promise<DispatchOutcome> {
  const claim = await db.notificationJob.updateMany({
    where: { id: job.id, status: "SCHEDULED" },
    data: { status: "PROCESSING" },
  });
  if (claim.count === 0) return "ALREADY_CLAIMED";

  try {
    const result = await CHANNEL_SENDERS[job.channel](job);

    if (result.ok) {
      await db.notificationJob.update({
        where: { id: job.id },
        data: { status: "SENT", sentAt: new Date(), failedReason: null },
      });
      return "SENT";
    }

    return await recordFailure(job, result.reason, result.retryable);
  } catch (error) {
    if (error instanceof NotImplementedChannelError) {
      await db.notificationJob.update({
        where: { id: job.id },
        data: { status: "SKIPPED", failedReason: error.message },
      });
      return "SKIPPED";
    }

    const reason = error instanceof Error ? error.message : String(error);
    return recordFailure(job, reason, true);
  }
}

async function recordFailure(
  job: NotificationJobWithMetadata,
  reason: string,
  retryable: boolean,
): Promise<DispatchOutcome> {
  const retryCount = job.retryCount + 1;
  const givingUp = !retryable || retryCount >= MAX_SEND_ATTEMPTS;

  await db.notificationJob.update({
    where: { id: job.id },
    data: {
      status: givingUp ? "FAILED" : "SCHEDULED",
      retryCount,
      failedReason: reason,
    },
  });

  return givingUp ? "FAILED" : "RETRY_SCHEDULED";
}
