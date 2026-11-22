/**
 * The reminder generator. Vercel Cron calls this hourly (see `vercel.json`)
 * with `Authorization: Bearer $CRON_SECRET`; it queues today's reminders
 * for every user (idempotently, so repeated runs never duplicate) and
 * `/api/cron/notifications` sends them. Property issues' own alerts (key
 * dates, "Finalise this?", freehold check-ins) are queued in the same run.
 */
import { cronRoute } from "~/server/cron-route";
import { generateIssueAlerts } from "~/server/issues/alerts";
import { generateReminders } from "~/server/reminders/generate";

// Comfortably above the generator's time budget (`TIME_BUDGET_MS`, 4 min).
export const maxDuration = 300;

export const GET = cronRoute("reminders", async () => {
  const reminders = await generateReminders();
  // After the bills, so a slow bill run can't starve them: there are far
  // fewer open issues than bills.
  const issues = await generateIssueAlerts();
  return {
    ...reminders,
    // Top-level, where the run's health record looks for skipped records.
    failed: reminders.failed + issues.failed,
    firstError: reminders.firstError ?? issues.firstError,
    issues,
  };
});
