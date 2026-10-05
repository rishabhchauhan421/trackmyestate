/**
 * Date-only values — due dates, purchase dates, lease start/end — and the
 * one convention the app uses for them:
 *
 *   **A date-only value is stored as midnight UTC of its calendar day, and
 *   read back as its UTC calendar day.**
 *
 * That's exactly what an `<input type="date">` value ("2026-10-08") parses
 * to, so form-entered dates need no conversion, and the day never shifts
 * with the server's or the viewer's time zone. Only "today" depends on a
 * time zone (the user's — see `todayInTimeZone`). Timestamps (`createdAt`,
 * `sentAt`) are real instants and are not calendar days.
 */

/** A calendar day, "YYYY-MM-DD". */
export type CalendarDay = string;

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The calendar day a stored date-only value represents. */
export function calendarDayOf(date: Date): CalendarDay {
  return date.toISOString().slice(0, 10);
}

/** The stored form of a calendar day: midnight UTC. */
export function dateOnly(day: CalendarDay): Date {
  const match = DAY_PATTERN.exec(day);
  if (!match) throw new Error(`Not a calendar day: "${day}"`);
  const [, year, month, date] = match.map(Number) as [
    number,
    number,
    number,
    number,
  ];
  const result = new Date(Date.UTC(year, month - 1, date));
  if (calendarDayOf(result) !== day) {
    throw new Error(`Not a calendar day: "${day}"`);
  }
  return result;
}

/** `day` moved by `days` calendar days. */
export function addDays(day: CalendarDay, days: number): CalendarDay {
  const date = dateOnly(day);
  date.setUTCDate(date.getUTCDate() + days);
  return calendarDayOf(date);
}

/** Moves a stored date-only value to the same calendar day, `months` later. */
export function addMonths(day: CalendarDay, months: number): CalendarDay {
  const date = dateOnly(day);
  date.setUTCMonth(date.getUTCMonth() + months);
  return calendarDayOf(date);
}
