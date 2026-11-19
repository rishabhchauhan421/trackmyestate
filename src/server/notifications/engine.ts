/**
 * Dispatches one `NotificationJob` to its channel and records the outcome.
 * The other half of the engine — picking which due jobs to dispatch — is
 * `processDueNotificationJobs` in `./process`.
 */
import "server-only";

import { db } from "~/server/db";
import { CHANNEL_DIGEST_SENDERS, CHANNEL_SENDERS } from "./registry";
import { isEmailSuppressed } from "./suppression";
import { NotImplementedChannelError } from "./types";
import type { ChannelSendResult, NotificationJobWithMetadata } from "./types";

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

/**
 * How long a job waits after the provider throttled us. Short: it's
 * picked up by the next run, which is at least this far away.
 */
export const RATE_LIMIT_DELAY_MS = 60 * 1000;

export type DispatchOutcome =
  | "SENT"
  | "SKIPPED"
  | "RETRY_SCHEDULED"
  | "RATE_LIMITED"
  | "FAILED"
  | "ALREADY_CLAIMED"
  | "CANCELLED"
  /**
   * Checking the job threw unexpectedly (e.g. a database error). It stays
   * claimed and is reclaimed by a later run (see `reclaimStaleJobs`).
   */
  | "ERRORED";

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
  return (await dispatchNotificationJobs([job]))[0]!;
}

/**
 * Dispatches jobs that are all for the same recipient (see `digestKey`).
 * Each is claimed and checked on its own; if more than one is still worth
 * sending and the channel can combine them, they go out as one message (a
 * digest) and share its result. Returns each job's outcome, in order.
 */
export async function dispatchNotificationJobs(
  jobs: NotificationJobWithMetadata[],
): Promise<DispatchOutcome[]> {
  const outcomes = new Map<string, DispatchOutcome>();
  const ready: NotificationJobWithMetadata[] = [];
  for (const job of jobs) {
    try {
      const settled = await claimAndCheck(job);
      if (settled) outcomes.set(job.id, settled);
      else ready.push(job);
    } catch (error) {
      // One job's trouble must not hold up the recipient's others.
      console.error(`[notifications] Checking job ${job.id} failed`, error);
      outcomes.set(job.id, "ERRORED");
    }
  }

  const sendDigest =
    ready.length > 1 ? CHANNEL_DIGEST_SENDERS[ready[0]!.channel] : undefined;
  if (sendDigest) {
    const result = await attempt(() => sendDigest(ready));
    for (const job of ready) {
      outcomes.set(job.id, await recordResult(job, result));
    }
  } else {
    for (const job of ready) {
      const result = await attempt(() => CHANNEL_SENDERS[job.channel](job));
      outcomes.set(job.id, await recordResult(job, result));
    }
  }

  return jobs.map((job) => outcomes.get(job.id)!);
}

/**
 * Which jobs can share one message: the same person, hearing from the same
 * owner, over the same channel, in the same capacity (someone with access
 * to the bills, or someone reminded on the owner's behalf).
 */
export function digestKey(job: NotificationJobWithMetadata) {
  return [
    job.channel,
    job.ownerId,
    job.recipient.trim().toLowerCase(),
    job.metadata?.thirdParty === true ? "third-party" : "own",
  ].join("|");
}

/**
 * Claims `job` and checks it's still worth sending. Returns its outcome if
 * it's settled without sending (claimed elsewhere, or cancelled), or null
 * when it's ready to send.
 */
async function claimAndCheck(
  job: NotificationJobWithMetadata,
): Promise<DispatchOutcome | null> {
  const claim = await db.notificationJob.updateMany({
    where: { id: job.id, status: "SCHEDULED" },
    data: { status: "PROCESSING" },
  });
  if (claim.count === 0) return "ALREADY_CLAIMED";

  // Stop when paid or gone: a reminder for a bill settled, or removed (its
  // asset was deleted or its schedule changed) since it was queued, is
  // cancelled rather than sent. `findUnique` isn't soft-delete filtered
  // (see `~/server/soft-delete`), hence the `deletedAt` check.
  if (job.billId) {
    const bill = await db.bill.findUnique({
      where: { id: job.billId },
      select: { status: true, deletedAt: true },
    });
    const reason = !bill
      ? "Bill no longer exists"
      : bill.deletedAt
        ? "Bill was removed"
        : !OPEN_BILL_STATUSES.includes(bill.status)
          ? `Bill is ${bill.status.toLowerCase()}`
          : null;
    if (reason) return cancel(job, reason);
  }

  // A guest who stopped reminders, was paused or was removed since the job
  // was queued doesn't get it.
  const guestId = job.metadata?.guestId;
  if (typeof guestId === "string") {
    const guest = await db.guest.findUnique({
      where: { id: guestId },
      select: { pausedAt: true, optedOutAt: true, deletedAt: true },
    });
    const reason = !guest
      ? "Guest no longer exists"
      : guest.optedOutAt
        ? "Guest stopped reminders"
        : guest.deletedAt
          ? "Guest was removed"
          : guest.pausedAt
            ? "Guest is paused"
            : null;
    if (reason) return cancel(job, reason);
  }

  // Someone emailed on the owner's behalf who has since unsubscribed (from
  // this owner, or from everyone) doesn't get it.
  if (
    job.channel === "EMAIL" &&
    (job.metadata?.thirdParty === true || typeof guestId === "string") &&
    (await isEmailSuppressed(job.recipient, job.ownerId))
  ) {
    return cancel(job, "Recipient unsubscribed");
  }

  return null;
}

async function cancel(
  job: NotificationJobWithMetadata,
  reason: string,
): Promise<DispatchOutcome> {
  await db.notificationJob.update({
    where: { id: job.id },
    data: { status: "CANCELLED", failedReason: reason },
  });
  return "CANCELLED";
}

type AttemptResult = ChannelSendResult | { notImplemented: string };

/** Runs a sender, turning anything it throws into a result. */
async function attempt(
  send: () => Promise<ChannelSendResult>,
): Promise<AttemptResult> {
  try {
    return await send();
  } catch (error) {
    if (error instanceof NotImplementedChannelError) {
      return { notImplemented: error.message };
    }
    const reason = error instanceof Error ? error.message : String(error);
    return { ok: false, retryable: true, reason };
  }
}

/** Writes a send's result back to `job`. */
async function recordResult(
  job: NotificationJobWithMetadata,
  result: AttemptResult,
): Promise<DispatchOutcome> {
  if ("notImplemented" in result) {
    await db.notificationJob.update({
      where: { id: job.id },
      data: { status: "SKIPPED", failedReason: result.notImplemented },
    });
    return "SKIPPED";
  }

  if (result.ok) {
    await db.notificationJob.update({
      where: { id: job.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        failedReason: null,
        providerMessageId: result.providerMessageId ?? null,
      },
    });
    return "SENT";
  }

  // Throttled: nothing wrong with the job, so it keeps its attempts and
  // simply waits for the next run.
  if (result.rateLimited) {
    await db.notificationJob.update({
      where: { id: job.id },
      data: {
        status: "SCHEDULED",
        failedReason: result.reason,
        scheduledFor: new Date(Date.now() + RATE_LIMIT_DELAY_MS),
      },
    });
    return "RATE_LIMITED";
  }

  return recordFailure(job, result.reason, result.retryable);
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
