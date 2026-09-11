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
