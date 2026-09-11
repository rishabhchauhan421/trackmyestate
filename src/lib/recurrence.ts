/**
 * Cycle math for a `BillSchedule.recurrence`. Lives here (not in
 * `server/actions/utilities.ts`) because a `"use server"` file may only
 * export async functions, and this is pure/sync — it's also meant to be
 * reused by the not-yet-built background job that generates `Bill` rows,
 * not just by the app's own actions.
 */
import type { BillRecurrence } from "../../generated/prisma";

/**
 * Returns a new `Date` one cycle after `date`, per `recurrence`. Does not
 * mutate `date`.
 *
 * Uses `Date.setMonth`/`setFullYear`, which overflow into the next month
 * when the target month is shorter than the current day-of-month (e.g. Jan
 * 31 + 1 month lands on Mar 3, not Feb 28) — see `recurrence.test.ts` for
 * the exact documented behavior.
 */
export function advanceByRecurrence(
  date: Date,
  recurrence: BillRecurrence,
): Date {
  const next = new Date(date);
  switch (recurrence) {
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      break;
    case "BI_WEEKLY":
      next.setDate(next.getDate() + 14);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + 1);
      break;
    case "QUARTERLY":
      next.setMonth(next.getMonth() + 3);
      break;
    case "HALF_YEARLY":
      next.setMonth(next.getMonth() + 6);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}
