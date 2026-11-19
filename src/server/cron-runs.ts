/**
 * Bookkeeping for the background jobs Vercel Cron runs (`vercel.json`):
 * each run is recorded in `CronRun`, and `cronHealth` says which job hasn't
 * succeeded on time — a missed schedule, or runs that keep failing. The
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

/** Runs `job`, recording when it started and how it ended. */
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
      data: { lastSucceededAt: new Date(), lastError: null },
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
      late:
        !lastSucceededAt ||
        now.getTime() - lastSucceededAt.getTime() > deadline,
    };
  });
}
