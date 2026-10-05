/**
 * Shared display formatters for money and dates. Every amount in the app is
 * currently rendered as INR regardless of a record's `Currency` field — see
 * the README's "What's next" for surfacing real multi-currency display.
 */

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
 * Formats a date as `"5 Mar 2026"`. Throws if `date` is invalid (e.g. built
 * from an unparseable string), matching `Intl.DateTimeFormat`'s own behavior.
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Formats a date as `"2026-03-05"`, the value an `<input type="date">`
 * expects for `defaultValue` — using local calendar fields, not `toISOString`
 * (which would shift the date at UTC offsets behind local midnight).
 */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** "5 Oct" — compact date for lists where the year is obvious. */
export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
  }).format(date);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole calendar days from `now` to `date` (negative when it's past). */
export function daysUntil(date: Date, now: Date = new Date()): number {
  const startOf = (d: Date) =>
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((startOf(date) - startOf(now)) / DAY_MS);
}

/** "Overdue 3 days" / "Due today" / "Tomorrow" / "In 5 days". */
export function formatDueIn(date: Date, now: Date = new Date()): string {
  const days = daysUntil(date, now);
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
