/**
 * Sends due reminders. Vercel Cron calls this every 15 minutes (see
 * `vercel.json`) with `Authorization: Bearer $CRON_SECRET`; anything else
 * is rejected so the send path can't be triggered by a stray request.
 */
import { cronRoute } from "~/server/cron-route";
import { processDueNotificationJobs } from "~/server/notifications/process";

// Comfortably above the drain's time budget (`TIME_BUDGET_MS`, 4 min), so the
// batch in flight when the budget runs out can still finish.
export const maxDuration = 300;

export const GET = cronRoute("notifications", () =>
  processDueNotificationJobs(),
);
