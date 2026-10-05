/**
 * Entry point for draining due notifications — called by the cron route
 * (`src/app/api/cron/notifications/route.ts`) every 15 minutes. Each run:
 *
 * 1. Puts jobs stuck in `PROCESSING` (a run that died mid-send) back in
 *    the queue.
 * 2. Dispatches due `SCHEDULED` jobs via `./engine`, in batches, until the
 *    queue is empty or the time budget is spent — whatever's left waits
 *    for the next run instead of overrunning the function's time limit.
 * 3. Deletes finished jobs past the retention window.
 */
import "server-only";

import { db } from "~/server/db";
import { MAX_SEND_ATTEMPTS, dispatchNotificationJob } from "./engine";
import type { DispatchOutcome } from "./engine";
import type { NotificationJobWithMetadata } from "./types";

/** Jobs fetched per query. */
export const BATCH_SIZE = 100;

/**
 * No new batch starts after this long. Well inside the cron route's
 * `maxDuration`, so the batch in flight can finish.
 */
export const TIME_BUDGET_MS = 45_000;

/** A job `PROCESSING` for longer than this was abandoned by a dead run. */
export const STALE_CLAIM_MS = 10 * 60 * 1000;

/** Finished jobs scheduled longer ago than this are deleted. */
export const RETENTION_DAYS = 90;

const FINISHED_STATUSES = ["SENT", "FAILED", "SKIPPED", "CANCELLED"] as const;

export interface ProcessDueJobsSummary {
  total: number;
  outcomes: Record<DispatchOutcome, number>;
  /** Stuck jobs put back in the queue (or failed, if out of attempts). */
  reclaimed: number;
  /** Old finished jobs deleted. */
  purged: number;
  /** True when the time budget ran out with due jobs possibly left over. */
  hasMore: boolean;
}

const EMPTY_OUTCOMES: Record<DispatchOutcome, number> = {
  SENT: 0,
  SKIPPED: 0,
  RETRY_SCHEDULED: 0,
  FAILED: 0,
  ALREADY_CLAIMED: 0,
  CANCELLED: 0,
};

/**
 * Dispatches due jobs serially (jobs hit third-party APIs with their own
 * rate limits, so we don't fan them out concurrently). One job's failure
 * never stops the batch — each is caught and recorded by
 * `dispatchNotificationJob` itself.
 *
 * A job can't be picked twice in one run: dispatching moves it out of
 * `SCHEDULED`, and a retry is rescheduled into the future (after `now`).
 */
export async function processDueNotificationJobs(
  now = new Date(),
  { timeBudgetMs = TIME_BUDGET_MS, clock = () => Date.now() } = {},
): Promise<ProcessDueJobsSummary> {
  const startedAt = clock();
  const reclaimed = await reclaimStaleJobs(now);

  const outcomes = { ...EMPTY_OUTCOMES };
  let total = 0;
  let hasMore = false;

  for (;;) {
    const batch = (await db.notificationJob.findMany({
      where: { status: "SCHEDULED", scheduledFor: { lte: now } },
      orderBy: { scheduledFor: "asc" },
      take: BATCH_SIZE,
    })) as NotificationJobWithMetadata[];

    for (const job of batch) {
      const outcome = await dispatchNotificationJob(job);
      outcomes[outcome] += 1;
    }
    total += batch.length;

    if (batch.length < BATCH_SIZE) break;
    if (clock() - startedAt >= timeBudgetMs) {
      hasMore = true;
      break;
    }
  }

  const purged = await purgeFinishedJobs(now);

  return { total, outcomes, reclaimed, purged, hasMore };
}

/**
 * Jobs a run claimed (`PROCESSING`) but never finished — the function
 * timed out or crashed mid-send. Each reclaim counts as an attempt, so a
 * job that keeps killing the run ends up `FAILED` instead of looping.
 * (The send may in fact have gone out before the crash; retrying accepts a
 * rare duplicate over a silently lost reminder.)
 */
async function reclaimStaleJobs(now: Date) {
  const stale = {
    status: "PROCESSING" as const,
    updatedAt: { lt: new Date(now.getTime() - STALE_CLAIM_MS) },
  };
  const reason = "Interrupted while sending";

  const outOfAttempts = await db.notificationJob.updateMany({
    where: { ...stale, retryCount: { gte: MAX_SEND_ATTEMPTS - 1 } },
    data: {
      status: "FAILED",
      retryCount: { increment: 1 },
      failedReason: reason,
    },
  });
  const requeued = await db.notificationJob.updateMany({
    where: stale,
    data: {
      status: "SCHEDULED",
      retryCount: { increment: 1 },
      failedReason: reason,
    },
  });

  return outOfAttempts.count + requeued.count;
}

/** Keeps the job table from growing forever. */
async function purgeFinishedJobs(now: Date) {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await db.notificationJob.deleteMany({
    where: {
      status: { in: [...FINISHED_STATUSES] },
      scheduledFor: { lt: cutoff },
    },
  });
  return count;
}
