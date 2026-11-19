/**
 * The bill generator. Vercel Cron calls this daily (see `vercel.json`) with
 * `Authorization: Bearer $CRON_SECRET`; admins can also run it from
 * Admin › Jobs.
 */
import { generateBills } from "~/server/bills/generate";
import { cronRoute } from "~/server/cron-route";

// Comfortably above the generator's time budget (`TIME_BUDGET_MS`, 45s).
export const maxDuration = 60;

export const GET = cronRoute("bills", () => generateBills());
