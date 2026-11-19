/**
 * For an uptime monitor: 200 when the background jobs are healthy, 503
 * (saying what's wrong) otherwise:
 *
 * - `late`: a job hasn't succeeded on time — a missed Vercel Cron run, or
 *   runs that keep failing.
 * - `warnings`: a job's last run skipped records that threw.
 * - `sending.stuck`: a due reminder has waited over an hour.
 * - `sending.failing`: most reminders in the last 24 hours failed (a bad
 *   API key, an unverified domain, a provider outage).
 *
 * See `~/server/cron-runs`.
 */
import { NextResponse } from "next/server";

import { cronHealth, sendHealth } from "~/server/cron-runs";

export async function GET() {
  const [jobs, sending] = await Promise.all([cronHealth(), sendHealth()]);
  const late = jobs.filter((job) => job.late).map((job) => job.job);
  const warnings = Object.fromEntries(
    jobs.flatMap((job) =>
      job.lastWarning ? [[job.job, job.lastWarning]] : [],
    ),
  );
  const ok =
    late.length === 0 &&
    Object.keys(warnings).length === 0 &&
    !sending.stuck &&
    !sending.failing;
  return NextResponse.json(
    {
      ok,
      late,
      warnings,
      sending,
      lastSucceededAt: Object.fromEntries(
        jobs.map((job) => [job.job, job.lastSucceededAt]),
      ),
    },
    { status: ok ? 200 : 503 },
  );
}
