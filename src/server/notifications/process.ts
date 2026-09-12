/**
 * Entry point for draining due notifications — called by the cron route
 * (`src/app/api/cron/notifications/route.ts`). Finds every `SCHEDULED` job
 * whose time has come and dispatches each one via `./engine`.
 */
import "server-only";

import { db } from "~/server/db";
import { dispatchNotificationJob } from "./engine";
import type { DispatchOutcome } from "./engine";
import type { NotificationJobWithMetadata } from "./types";

export interface ProcessDueJobsSummary {
  total: number;
  outcomes: Record<DispatchOutcome, number>;
}

const EMPTY_OUTCOMES: Record<DispatchOutcome, number> = {
  SENT: 0,
  SKIPPED: 0,
  RETRY_SCHEDULED: 0,
  FAILED: 0,
  ALREADY_CLAIMED: 0,
};

/**
 * Dispatches every due job serially (jobs hit third-party APIs with their
 * own rate limits, so we don't fan them out concurrently). One job's
 * failure never stops the batch — each is caught and recorded by
 * `dispatchNotificationJob` itself.
 */
export async function processDueNotificationJobs(
  now = new Date(),
): Promise<ProcessDueJobsSummary> {
  const dueJobs = (await db.notificationJob.findMany({
    where: { status: "SCHEDULED", scheduledFor: { lte: now } },
    orderBy: { scheduledFor: "asc" },
  })) as NotificationJobWithMetadata[];

  const outcomes = { ...EMPTY_OUTCOMES };
  for (const job of dueJobs) {
    const outcome = await dispatchNotificationJob(job);
    outcomes[outcome] += 1;
  }

  return { total: dueJobs.length, outcomes };
}
