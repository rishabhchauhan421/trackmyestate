import "server-only";

import type {
  Currency,
  EventCategory,
  FinancialEventType,
} from "../../../generated/prisma";
import { billTitle } from "~/lib/bill-context";
import { addDays, calendarDayOf, dateOnly } from "~/lib/calendar-day";
import { reminderCategoryConfig } from "~/lib/reminders";
import { occurrencesBetween } from "~/lib/schedule";
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

/** One row of the timeline: a real bill, or one a schedule will create. */
export interface TimelineEvent {
  id: string;
  /** The bill's id; null for a projected event (no bill exists yet). */
  billId: string | null;
  projected: boolean;
  category: EventCategory;
  direction: FinancialEventType;
  dueDate: Date;
  amount: number;
  currency: Currency | null;
  /** PaymentStatus for a bill; "PROJECTED" for a projected event. */
  status: string;
  description: string;
}

/**
 * The Timeline page's events in a calendar range, optionally only inflows
 * or only outflows: every bill in the range, plus — from today on — what
 * each active schedule will bill that hasn't been generated yet (bills are
 * only generated about a month ahead, but a quarter or year view should
 * still show next March's premium).
 */
export async function getTimelineEvents(
  householdId: string,
  range: TimelineRange,
  filter: TimelineFilter,
  timeZone: string = DEFAULT_TIME_ZONE,
  now: Date = new Date(),
): Promise<TimelineEvent[]> {
  const { start, end } = rangeBounds(range, now, timeZone);
  const direction =
    filter === "inflow"
      ? ("INFLOW" as const)
      : filter === "outflow"
        ? ("OUTFLOW" as const)
        : undefined;

  const [bills, schedules] = await Promise.all([
    db.bill.findMany({
      where: {
        householdId,
        dueDate: { gte: start, lt: end },
        ...(direction && { direction }),
      },
      orderBy: { dueDate: "asc" },
    }),
    db.billSchedule.findMany({
      where: { householdId, active: true },
      include: {
        property: { select: { id: true, name: true } },
        lease: { select: { id: true, tenantName: true, propertyId: true } },
        loan: { select: { id: true, lender: true } },
        policy: { select: { id: true, insurer: true } },
        investment: { select: { id: true, name: true } },
      },
    }),
  ]);

  const events: TimelineEvent[] = bills.map((bill) => ({
    id: bill.id,
    billId: bill.id,
    projected: false,
    category: bill.category,
    direction: bill.direction,
    dueDate: bill.dueDate,
    amount: bill.amount,
    currency: bill.currency,
    status: bill.status,
    description: bill.description ?? billTitle(bill),
  }));

  // Projected events: from today (or the range start, if later) to the end.
  const billed = new Set(
    bills.map(
      (bill) => `${bill.billScheduleId}:${calendarDayOf(bill.dueDate)}`,
    ),
  );
  const today = todayInTimeZone(timeZone, now);
  const from = calendarDayOf(start) > today ? calendarDayOf(start) : today;
  const to = addDays(calendarDayOf(end), -1);
  for (const schedule of schedules) {
    if (schedule.defaultAmount == null || schedule.defaultAmount <= 0) continue;
    const scheduleDirection = reminderCategoryConfig(schedule.category).incoming
      ? "INFLOW"
      : "OUTFLOW";
    if (direction && scheduleDirection !== direction) continue;
    const description = billTitle({ ...schedule, billSchedule: schedule });
    for (const { day } of occurrencesBetween(schedule, from, to)) {
      if (billed.has(`${schedule.id}:${day}`)) continue;
      events.push({
        id: `projected:${schedule.id}:${day}`,
        billId: null,
        projected: true,
        category: schedule.category,
        direction: scheduleDirection,
        dueDate: dateOnly(day),
        amount: schedule.defaultAmount,
        currency: schedule.currency,
        status: "PROJECTED",
        description,
      });
    }
  }

  return events.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}
