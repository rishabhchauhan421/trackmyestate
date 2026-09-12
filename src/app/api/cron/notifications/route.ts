/**
 * Cron entry point for the notification engine. Vercel Cron (see
 * `vercel.json`) hits this on a schedule with `Authorization: Bearer
 * $CRON_SECRET`; anything else is rejected so the send path can't be
 * triggered by a stray request.
 */
import { NextResponse, type NextRequest } from "next/server";

import { env } from "~/env";
import { processDueNotificationJobs } from "~/server/notifications/process";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await processDueNotificationJobs();
  return NextResponse.json(summary);
}
