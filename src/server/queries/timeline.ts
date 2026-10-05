import "server-only";

import { DEFAULT_TIME_ZONE, todayInTimeZone } from "~/lib/time-zone";
import { db } from "~/server/db";

export type TimelineRange = "month" | "quarter" | "year";
export type TimelineFilter = "all" | "inflow" | "outflow";

/**
 * The `[start, end)` window of date-only values for a timeline range,
 * anchored to the current calendar month/quarter/year where the user is.
 * Month indexes past 11 (Q4's end) roll into January via `Date.UTC`.
 */
export function rangeBounds(
  range: TimelineRange,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): { start: Date; end: Date } {
  const [year, month] = todayInTimeZone(timeZone, now)
    .split("-")
    .map(Number) as [number, number];
  const monthIndex = month - 1;
  const at = (y: number, m: number) => new Date(Date.UTC(y, m, 1));
  if (range === "year") {
    return { start: at(year, 0), end: at(year + 1, 0) };
  }
  if (range === "quarter") {
    const quarterStart = Math.floor(monthIndex / 3) * 3;
    return { start: at(year, quarterStart), end: at(year, quarterStart + 3) };
  }
  return { start: at(year, monthIndex), end: at(year, monthIndex + 1) };
}

/**
 * Bills for the Timeline page, bounded to the given calendar range and
 * optionally filtered to only inflows or only outflows.
 */
export async function getTimelineEvents(
  ownerId: string,
  range: TimelineRange,
  filter: TimelineFilter,
  timeZone: string = DEFAULT_TIME_ZONE,
) {
  const { start, end } = rangeBounds(range, new Date(), timeZone);
  return db.bill.findMany({
    where: {
      ownerId,
      dueDate: { gte: start, lt: end },
      ...(filter === "inflow" && { direction: "INFLOW" }),
      ...(filter === "outflow" && { direction: "OUTFLOW" }),
    },
    orderBy: { dueDate: "asc" },
  });
}
