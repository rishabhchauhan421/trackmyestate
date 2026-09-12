import "server-only";

import { db } from "~/server/db";

export type TimelineRange = "month" | "quarter" | "year";
export type TimelineFilter = "all" | "inflow" | "outflow";

/**
 * Computes the `[start, end)` window for a timeline range, anchored to the
 * current calendar month/quarter/year. Quarter/year bounds intentionally
 * pass a month index of 12+ to `Date`'s constructor when the period crosses
 * a year boundary (e.g. Q4 -> month 12) — `Date` normalizes that into
 * January of the following year, which is the desired result.
 */
function rangeBounds(range: TimelineRange): { start: Date; end: Date } {
  const now = new Date();
  if (range === "year") {
    return {
      start: new Date(now.getFullYear(), 0, 1),
      end: new Date(now.getFullYear() + 1, 0, 1),
    };
  }
  if (range === "quarter") {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    return {
      start: new Date(now.getFullYear(), quarterStartMonth, 1),
      end: new Date(now.getFullYear(), quarterStartMonth + 3, 1),
    };
  }
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

/**
 * Bills for the Timeline page, bounded to the given calendar range and
 * optionally filtered to only inflows or only outflows.
 */
export async function getTimelineEvents(
  ownerId: string,
  range: TimelineRange,
  filter: TimelineFilter,
) {
  const { start, end } = rangeBounds(range);
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
