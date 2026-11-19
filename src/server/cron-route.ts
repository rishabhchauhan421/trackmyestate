import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { env } from "~/env";
import { recordCronRun, type CronJob } from "./cron-runs";

/**
 * A cron route's handler: rejects anything without
 * `Authorization: Bearer $CRON_SECRET` (which Vercel Cron sends), then
 * runs and records `job`.
 */
export function cronRoute<T>(job: CronJob, run: () => Promise<T>) {
  return async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(await recordCronRun(job, run));
  };
}
