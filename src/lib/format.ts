/**
 * Shared display formatters for money and dates. An amount is shown in its
 * record's currency, or the user's (Settings › General) when the record
 * has none. Amounts in different currencies are never added together:
 * totals are kept per currency (see `~/lib/money-totals`).
 *
 * Dates: date-only values (due dates, purchase dates…) follow the
 * convention in `~/lib/calendar-day` — stored as midnight UTC, shown as
 * that calendar day whatever the server's or viewer's time zone.
 */
import type { Currency } from "../../generated/prisma";
import { calendarDayOf } from "./calendar-day";
import { fromMinorUnits } from "./money";
import { DEFAULT_TIME_ZONE, daysBetween, todayInTimeZone } from "./time-zone";

/** The locale each currency is written in: digit grouping and symbol. */
const CURRENCY_LOCALES: Record<Currency, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "en-IE",
  GBP: "en-GB",
  CAD: "en-CA",
  AED: "en-AE",
  SGD: "en-SG",
  AUD: "en-AU",
};

const formatters = new Map<Currency, Intl.NumberFormat>();

/**
 * Formats an amount stored in minor units (see `~/lib/money`) as whole
 * units of `currency`, e.g. `123456` -> `"₹1,235"` (Indian lakh/crore
 * grouping) or `"$1,235"`.
 */
export function formatMoney(
  amountMinor: number,
  currency: Currency | null | undefined = "INR",
): string {
  const code = currency ?? "INR";
  let formatter = formatters.get(code);
  if (!formatter) {
    formatter = new Intl.NumberFormat(CURRENCY_LOCALES[code], {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    });
    formatters.set(code, formatter);
  }
  return formatter.format(fromMinorUnits(amountMinor));
}

/** "₹", "$", "£", "AED"… — for labels like "Rent (₹/month)". */
export function currencySymbol(currency: Currency | null | undefined): string {
  return formatMoney(0, currency).replace(/[\d\s.,]/g, "");
}

/** `formatMoney` in rupees. */
export function formatINR(amountMinor: number): string {
  return formatMoney(amountMinor, "INR");
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
export function formatBillAmount(
  amountMinor: number,
  approx: boolean,
  currency?: Currency | null,
): string {
  const money = formatMoney(amountMinor, currency);
  return approx ? `Approx. ${money}` : money;
}
