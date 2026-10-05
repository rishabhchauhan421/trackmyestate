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

/**
 * Delay before retrying a failed send: 5 min, then 10, then 20. Pushing
 * `scheduledFor` into the future also keeps a draining run from picking
 * the same job straight back up (see `processDueNotificationJobs`).
 */
export const RETRY_BASE_DELAY_MS = 5 * 60 * 1000;

export function retryDelayMs(retryCount: number) {
  return RETRY_BASE_DELAY_MS * 2 ** Math.max(0, retryCount - 1);
}

export type DispatchOutcome =
  | "SENT"
  | "SKIPPED"
  | "RETRY_SCHEDULED"
  | "FAILED"
  | "ALREADY_CLAIMED"
  | "CANCELLED";

/** A bill in one of these is still awaiting payment, so still worth a reminder. */
const OPEN_BILL_STATUSES: readonly string[] = [
  "DUE",
  "OVERDUE",
  "PARTIALLY_PAID",
];

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

  // Stop when paid: a reminder for a bill settled since it was queued is
  // cancelled rather than sent.
  if (job.billId) {
    const bill = await db.bill.findUnique({
      where: { id: job.billId },
      select: { status: true },
    });
    if (bill && !OPEN_BILL_STATUSES.includes(bill.status)) {
      await db.notificationJob.update({
        where: { id: job.id },
        data: {
          status: "CANCELLED",
          failedReason: `Bill is ${bill.status.toLowerCase()}`,
        },
      });
      return "CANCELLED";
    }
  }

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
    data: givingUp
      ? { status: "FAILED", retryCount, failedReason: reason }
      : {
          status: "SCHEDULED",
          retryCount,
          failedReason: reason,
          scheduledFor: new Date(Date.now() + retryDelayMs(retryCount)),
        },
  });

  return givingUp ? "FAILED" : "RETRY_SCHEDULED";
}
