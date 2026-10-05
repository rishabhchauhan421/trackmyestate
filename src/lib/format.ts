/**
 * Shared display formatters for money and dates. Every amount in the app is
 * currently rendered as INR regardless of a record's `Currency` field — see
 * the README's "What's next" for surfacing real multi-currency display.
 *
 * Dates: date-only values (due dates, purchase dates…) follow the
 * convention in `~/lib/calendar-day` — stored as midnight UTC, shown as
 * that calendar day whatever the server's or viewer's time zone.
 */
import { calendarDayOf } from "./calendar-day";
import { DEFAULT_TIME_ZONE, daysBetween, todayInTimeZone } from "./time-zone";

/**
 * Formats a number as a whole-rupee INR amount (e.g. `1234.56` -> `"₹1,235"`),
 * using Indian digit grouping (lakh/crore), not Western thousands grouping.
 */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formats a date as `"5 Mar 2026"`. By default `date` is a date-only value
 * and shows its calendar day; pass a `timeZone` for a timestamp (e.g.
 * `createdAt`) to show the day it fell on there. Throws if `date` is
 * invalid, matching `Intl.DateTimeFormat`.
 */
export function formatDate(date: Date, timeZone = "UTC"): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(date);
}

/**
 * A date-only value as `"2026-03-05"`, the value an `<input type="date">`
 * expects for `defaultValue`.
 */
export function toDateInputValue(date: Date): string {
  return calendarDayOf(date);
}

/** "5 Oct" — a date-only value, compact, for lists where the year is obvious. */
export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Whole days from today (in `timeZone`) to a date-only value — negative
 * once it's past. Only "today" depends on the zone; the due day never
 * shifts.
 */
export function daysUntil(
  date: Date,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): number {
  return daysBetween(todayInTimeZone(timeZone, now), calendarDayOf(date));
}

/** "Overdue 3 days" / "Due today" / "Tomorrow" / "In 5 days". */
export function formatDueIn(
  date: Date,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): string {
  const days = daysUntil(date, now, timeZone);
  if (days < 0) {
    const overdue = -days;
    return `Overdue ${overdue} ${overdue === 1 ? "day" : "days"}`;
  }
  if (days === 0) return "Due today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

/**
 * A bill or schedule amount, marked "Approx." when it's only an estimate —
 * a variable (usage-based) utility's amount until the bill is actually paid.
 */
export function formatBillAmount(amount: number, approx: boolean): string {
  return approx ? `Approx. ${formatINR(amount)}` : formatINR(amount);
}
