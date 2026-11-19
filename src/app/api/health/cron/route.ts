/**
 * For an uptime monitor: 200 when every background job has succeeded on
 * time, 503 (naming the late jobs) when one hasn't — a missed Vercel Cron
 * run, or runs that keep failing. See `~/server/cron-runs`.
 */
import { NextResponse } from "next/server";

import { cronHealth } from "~/server/cron-runs";

export async function GET() {
  const jobs = await cronHealth();
  const late = jobs.filter((job) => job.late).map((job) => job.job);
  return NextResponse.json(
    {
      ok: late.length === 0,
      late,
      lastSucceededAt: Object.fromEntries(
        jobs.map((job) => [job.job, job.lastSucceededAt]),
      ),
    },
    { status: late.length === 0 ? 200 : 503 },
  );
}
