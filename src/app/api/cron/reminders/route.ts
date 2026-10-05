/**
 * Cron entry point for the reminder generator. Vercel Cron (see
 * `vercel.json`) hits this hourly with `Authorization: Bearer
 * $CRON_SECRET`; it queues today's reminders for every user (idempotently,
 * so hourly runs never duplicate) and `/api/cron/notifications` sends them.
 */
import { NextResponse, type NextRequest } from "next/server";

import { env } from "~/env";
import { generateReminders } from "~/server/reminders/generate";

// Comfortably above the generator's time budget (`TIME_BUDGET_MS`, 45s).
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await generateReminders();
  return NextResponse.json(summary);
}
