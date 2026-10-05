/**
 * When a recurring `BillSchedule` falls due — pure date arithmetic on
 * calendar days (see `~/lib/calendar-day`), shared by the bill generator
 * and the "next bill" shown to users.
 *
 * - Month-based schedules (monthly, quarterly, half-yearly, yearly) fall on
 *   `dueDay` of each period's month, clamped to the month's last day (a
 *   31st schedule falls on 28/29 Feb, then 31 Mar).
 * - Which months: counted from the anchor's month (`startDate`), or for a
 *   yearly schedule `dueMonth` when it has no start date.
 * - Weekly / every-2-weeks schedules step 7/14 days from the anchor.
 * - `tenureMonths` (e.g. an EMI) caps a month-based schedule at that many
 *   months' worth of instalments; each occurrence carries its instalment
 *   number.
 */
import type { BillRecurrence } from "../../generated/prisma";
import { addDays, calendarDayOf, type CalendarDay } from "./calendar-day";

export type ScheduleTiming = {
  recurrence: BillRecurrence;
  dueDay: number;
  dueMonth: number | null;
  startDate: Date | null;
  createdAt: Date;
  tenureMonths: number | null;
};

export type Occurrence = { day: CalendarDay; installment: number };

const MONTH_STEP: Partial<Record<BillRecurrence, number>> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  HALF_YEARLY: 6,
  YEARLY: 12,
};
const DAY_STEP: Partial<Record<BillRecurrence, number>> = {
  WEEKLY: 7,
  BI_WEEKLY: 14,
};

function daysInMonth(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** `dueDay` of the given month (0-based index may overflow into later years). */
function dayInMonth(year: number, monthIndex: number, dueDay: number) {
  const date = new Date(Date.UTC(year, monthIndex, 1));
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = Math.min(Math.max(dueDay, 1), daysInMonth(y, m));
  return calendarDayOf(new Date(Date.UTC(y, m, d)));
}

function parts(day: CalendarDay) {
  const [year, month] = day.split("-").map(Number) as [number, number];
  return { year, monthIndex: month - 1 };
}

/**
 * The schedule's first due day: its `startDate`, or — for an older
 * schedule without one — the first due day on or after it was created.
 */
export function scheduleAnchor(schedule: ScheduleTiming): CalendarDay {
  if (schedule.startDate) return calendarDayOf(schedule.startDate);

  const created = calendarDayOf(schedule.createdAt);
  const step = DAY_STEP[schedule.recurrence];
  if (step) return created;

  const { year, monthIndex } = parts(created);
  const isYearly = schedule.recurrence === "YEARLY";
  for (let k = 0; k < 24; k++) {
    const candidateMonth =
      isYearly && schedule.dueMonth
        ? schedule.dueMonth - 1 + 12 * k
        : monthIndex + k;
    const candidate = dayInMonth(year, candidateMonth, schedule.dueDay);
    if (candidate >= created) return candidate;
  }
  return created;
}

/** The k-th occurrence (k = 0 is the anchor's), before tenure limits. */
function occurrenceAt(
  schedule: ScheduleTiming,
  anchor: CalendarDay,
  k: number,
): CalendarDay {
  const dayStep = DAY_STEP[schedule.recurrence];
  if (dayStep) return addDays(anchor, dayStep * k);
  const monthStep = MONTH_STEP[schedule.recurrence] ?? 1;
  const { year, monthIndex } = parts(anchor);
  // Month-based schedules fall on `dueDay` — except the first, which is
  // the start date itself when one was given.
  if (k === 0 && schedule.startDate) return anchor;
  return dayInMonth(year, monthIndex + monthStep * k, schedule.dueDay);
}

/** How many occurrences the schedule has in total, or null for no end. */
function occurrenceLimit(schedule: ScheduleTiming) {
  const monthStep = MONTH_STEP[schedule.recurrence];
  if (!schedule.tenureMonths || !monthStep) return null;
  return Math.max(1, Math.floor(schedule.tenureMonths / monthStep));
}

/** Every due day in `[from, to]` (inclusive), in order. */
export function occurrencesBetween(
  schedule: ScheduleTiming,
  from: CalendarDay,
  to: CalendarDay,
): Occurrence[] {
  if (from > to) return [];
  const anchor = scheduleAnchor(schedule);
  const limit = occurrenceLimit(schedule);

  // Jump close to `from` instead of walking from the anchor year by year.
  let k = 0;
  if (from > anchor) {
    const dayStep = DAY_STEP[schedule.recurrence];
    if (dayStep) {
      const days =
        (Date.parse(`${from}T00:00:00Z`) - Date.parse(`${anchor}T00:00:00Z`)) /
        86_400_000;
      k = Math.max(0, Math.floor(days / dayStep) - 1);
    } else {
      const a = parts(anchor);
      const f = parts(from);
      const months = (f.year - a.year) * 12 + (f.monthIndex - a.monthIndex);
      k = Math.max(
        0,
        Math.floor(months / (MONTH_STEP[schedule.recurrence] ?? 1)) - 1,
      );
    }
  }

  const result: Occurrence[] = [];
  for (; limit === null || k < limit; k++) {
    const day = occurrenceAt(schedule, anchor, k);
    if (day > to) break;
    if (day >= from && day >= anchor) {
      result.push({ day, installment: k + 1 });
    }
  }
  return result;
}

/** The first due day on or after `day`, or null once the schedule has ended. */
export function nextOccurrence(
  schedule: ScheduleTiming,
  day: CalendarDay,
): Occurrence | null {
  // Every recurrence repeats within a year, so a 400-day window always
  // holds the next one if there is one.
  return occurrencesBetween(schedule, day, addDays(day, 400))[0] ?? null;
}

/**
 * The first `dueDay` strictly after `day` — e.g. a loan's first EMI after
 * its start date (a loan starting on the 5th with EMIs on the 5th first
 * pays a month later).
 */
export function firstDueDayAfter(
  day: CalendarDay,
  dueDay: number,
): CalendarDay {
  const { year, monthIndex } = parts(day);
  const thisMonth = dayInMonth(year, monthIndex, dueDay);
  return thisMonth > day ? thisMonth : dayInMonth(year, monthIndex + 1, dueDay);
}

/**
 * What to show as a schedule's next bill: the earliest unpaid bill already
 * generated for it (possibly overdue), or else the next due day the
 * schedule itself gives — so a brand-new schedule shows its first date
 * before any bill exists. Null when the schedule has ended.
 */
export function nextBillFor(
  schedule: ScheduleTiming & { defaultAmount: number | null },
  unpaidBills: { dueDate: Date; amount: number }[],
  today: CalendarDay,
): { dueDate: Date; amount: number | null } | null {
  const earliest = [...unpaidBills].sort(
    (a, b) => a.dueDate.getTime() - b.dueDate.getTime(),
  )[0];
  if (earliest) return { dueDate: earliest.dueDate, amount: earliest.amount };
  const next = nextOccurrence(schedule, today);
  return next
    ? {
        dueDate: new Date(`${next.day}T00:00:00.000Z`),
        amount: schedule.defaultAmount,
      }
    : null;
}
