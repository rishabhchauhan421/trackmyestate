/**
 * Bookkeeping for the background jobs Vercel Cron runs (`vercel.json`):
 * each run is recorded in `CronRun`, and `cronHealth` says which job hasn't
 * succeeded on time — a missed schedule, or runs that keep failing — or
 * skipped records that threw. `sendHealth` says whether the reminders
 * themselves are going out. The
 * public `/api/health/cron` route serves it for an uptime monitor, which
 * does the alerting (a scheduler that has stopped can't report itself).
 */
import "server-only";

import { db } from "~/server/db";

const MINUTE = 60 * 1000;

/** How often each job runs (see `vercel.json`). */
export const CRON_JOBS = {
  notifications: { everyMs: 15 * MINUTE },
  reminders: { everyMs: 60 * MINUTE },
  bills: { everyMs: 24 * 60 * MINUTE },
} as const;

export type CronJob = keyof typeof CRON_JOBS;

/**
 * A job is late when it hasn't succeeded for two of its intervals plus
 * this much: one missed run is tolerated, two in a row are not.
 */
export const GRACE_MS = 10 * MINUTE;

/** What a run reports about records it had to skip (see `recordCronRun`). */
function warningOf(result: unknown): string | null {
  if (typeof result !== "object" || result === null) return null;
  const { failed, firstError } = result as {
    failed?: unknown;
    firstError?: unknown;
  };
  if (typeof failed !== "number" || failed <= 0) return null;
  const detail = typeof firstError === "string" ? `: ${firstError}` : "";
  return `${failed} ${failed === 1 ? "record" : "records"} failed${detail}`;
}

/**
 * Runs `job`, recording when it started and how it ended. A run that
 * finishes but reports `failed` records (one bad schedule or bill, skipped
 * so the rest could go ahead) counts as a success with a `lastWarning`,
 * which `cronHealth` reports as failing until a clean run clears it.
 */
export async function recordCronRun<T>(
  job: CronJob,
  run: () => Promise<T>,
): Promise<T> {
  const startedAt = new Date();
  await db.cronRun.upsert({
    where: { job },
    create: { job, lastStartedAt: startedAt },
    update: { lastStartedAt: startedAt },
  });
  try {
    const result = await run();
    await db.cronRun.update({
      where: { job },
      data: {
        lastSucceededAt: new Date(),
        lastError: null,
        lastWarning: warningOf(result),
      },
    });
    return result;
  } catch (error) {
    await db.cronRun.update({
      where: { job },
      data: {
        lastFailedAt: new Date(),
        lastError: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

export interface CronJobHealth {
  job: CronJob;
  lastSucceededAt: Date | null;
  lastError: string | null;
  /** Records the last run skipped because they threw, if any. */
  lastWarning: string | null;
  late: boolean;
}

/** Each job's last success, and whether it's overdue. */
export async function cronHealth(now = new Date()): Promise<CronJobHealth[]> {
  const runs = await db.cronRun.findMany();
  return (Object.keys(CRON_JOBS) as CronJob[]).map((job) => {
    const run = runs.find((r) => r.job === job);
    const lastSucceededAt = run?.lastSucceededAt ?? null;
    const deadline = 2 * CRON_JOBS[job].everyMs + GRACE_MS;
    return {
      job,
      lastSucceededAt,
      lastError: run?.lastError ?? null,
      lastWarning: run?.lastWarning ?? null,
      late:
        !lastSucceededAt ||
        now.getTime() - lastSucceededAt.getTime() > deadline,
    };
  });
}

/** A reminder still unsent this long after it was due means sending is stuck. */
export const STUCK_AFTER_MS = 60 * MINUTE;

/** How far back `sendHealth` counts sent and failed reminders. */
export const SEND_WINDOW_MS = 24 * 60 * MINUTE;

/**
 * Sending counts as failing once at least this many reminders failed in
 * the window *and* they outnumber the ones sent: a provider outage or a
 * bad API key, not the odd mistyped address.
 */
export const MIN_FAILURES = 5;

export interface SendHealth {
  /** Reminders sent in the last 24 hours. */
  sent: number;
  /** Reminders that gave up in the last 24 hours. */
  failed: number;
  /** How long the oldest due, unsent reminder has waited (0 = none). */
  oldestDueMinutes: number;
  /** Due reminders aren't going out. */
  stuck: boolean;
  /** Most sends are failing. */
  failing: boolean;
}

/**
 * Whether reminders are actually reaching people — which the cron runs
 * alone can't say: a run that marks every email failed still "succeeds".
 */
export async function sendHealth(now = new Date()): Promise<SendHealth> {
  const since = new Date(now.getTime() - SEND_WINDOW_MS);
  const [sent, failed, oldestDue] = await Promise.all([
    db.notificationJob.count({
      where: { status: "SENT", updatedAt: { gte: since } },
    }),
    db.notificationJob.count({
      where: { status: "FAILED", updatedAt: { gte: since } },
    }),
    db.notificationJob.findFirst({
      where: { status: "SCHEDULED", scheduledFor: { lte: now } },
      orderBy: { scheduledFor: "asc" },
      select: { scheduledFor: true, createdAt: true },
    }),
  ]);
  // A reminder queued late (after its send time) has only waited since it
  // was queued.
  const waitingSince = oldestDue
    ? Math.max(oldestDue.scheduledFor.getTime(), oldestDue.createdAt.getTime())
    : null;
  const waitedMs = waitingSince === null ? 0 : now.getTime() - waitingSince;
  return {
    sent,
    failed,
    oldestDueMinutes: Math.floor(waitedMs / MINUTE),
    stuck: waitedMs > STUCK_AFTER_MS,
    failing: failed >= MIN_FAILURES && failed > sent,
  };
}
