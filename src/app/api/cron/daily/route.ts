/**
 * The one cron Vercel runs on the Hobby plan (which allows only daily
 * crons — see `vercel.json`): generate bills, queue today's reminders, then
 * send everything due, in that order.
 *
 * It runs at 03:30 UTC, 09:00 in India — the default send time — so even
 * with nothing else scheduled, India-based users get their reminders on
 * the right day. The more frequent runs that make other send times and
 * time zones exact come from `.github/workflows/cron.yml`, which calls the
 * single-job routes (`/api/cron/reminders`, `/api/cron/notifications`).
 * Every job is idempotent, so overlapping runs are harmless.
 */
import { NextResponse, type NextRequest } from "next/server";

import { env } from "~/env";
import { generateBills } from "~/server/bills/generate";
import { processDueNotificationJobs } from "~/server/notifications/process";
import { generateReminders } from "~/server/reminders/generate";

export const maxDuration = 60;

// Split the function's 60s between the three jobs, leaving headroom; any
// job that runs out of time reports `hasMore` and finishes on a later run.
const BUDGET_MS = { bills: 15_000, reminders: 15_000, notifications: 20_000 };

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const bills = await generateBills(now, { timeBudgetMs: BUDGET_MS.bills });
  const reminders = await generateReminders(now, {
    timeBudgetMs: BUDGET_MS.reminders,
  });
  // Re-read the clock: reminders queued above for "now" must be due.
  const notifications = await processDueNotificationJobs(new Date(), {
    timeBudgetMs: BUDGET_MS.notifications,
  });

  return NextResponse.json({ bills, reminders, notifications });
}
