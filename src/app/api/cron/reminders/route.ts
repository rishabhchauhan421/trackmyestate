/**
 * The reminder generator. Vercel Cron calls this hourly (see `vercel.json`)
 * with `Authorization: Bearer $CRON_SECRET`; it queues today's reminders
 * for every user (idempotently, so repeated runs never duplicate) and
 * `/api/cron/notifications` sends them.
 */
import { cronRoute } from "~/server/cron-route";
import { generateReminders } from "~/server/reminders/generate";

// Comfortably above the generator's time budget (`TIME_BUDGET_MS`, 4 min).
export const maxDuration = 300;

export const GET = cronRoute("reminders", () => generateReminders());
