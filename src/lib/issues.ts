/**
 * Property issues: the pure rules behind them, shared by the forms, the
 * pages and the alert generator (`~/server/issues/alerts`), so they can be
 * tested without a database.
 *
 * An issue is something that stops a property from being fully clear (a
 * dispute, a pending freehold conversion, unpaid dues). It carries key
 * dates; what's owed under it is ordinary bills. This file answers two
 * questions: which dates an instalment plan falls on, and which alerts an
 * issue is owed today.
 */
import { addDays, type CalendarDay } from "./calendar-day";
import { daysBetween } from "./time-zone";

/**
 * `day` moved `months` later, staying on the same day of the month, or on
 * the month's last day when it's shorter (31 Jan + 1 month = 28 Feb).
 */
export function addMonthsClamped(day: CalendarDay, months: number) {
  const [year, month, date] = day.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  first.setUTCDate(Math.min(date, lastDay));
  return first.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Instalment plans
// ---------------------------------------------------------------------------

/** How far apart a plan's instalments are, in months. */
export const PLAN_INTERVAL_MONTHS = {
  MONTHLY: 1,
  QUARTERLY: 3,
  HALF_YEARLY: 6,
  YEARLY: 12,
} as const;

export type PlanInterval = keyof typeof PLAN_INTERVAL_MONTHS;

export const PLAN_INTERVAL_LABELS: Record<PlanInterval, string> = {
  MONTHLY: "Every month",
  QUARTERLY: "Every 3 months",
  HALF_YEARLY: "Every 6 months",
  YEARLY: "Every year",
};

/** Most instalments one plan can create. */
export const MAX_PLAN_INSTALMENTS = 60;

export interface Instalment {
  /** 1 for the first. */
  number: number;
  dueDay: CalendarDay;
  /** In minor units. */
  amount: number;
}

/**
 * The instalments of a plan that splits `total` (minor units) evenly over
 * `count` payments, `interval` apart from `firstDueDay`. Whatever doesn't
 * divide evenly goes on the last instalment, so they always add up to
 * `total`.
 */
export function planInstalments({
  total,
  count,
  firstDueDay,
  interval,
}: {
  total: number;
  count: number;
  firstDueDay: CalendarDay;
  interval: PlanInterval;
}): Instalment[] {
  const each = Math.floor(total / count);
  const months = PLAN_INTERVAL_MONTHS[interval];
  return Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    dueDay: addMonthsClamped(firstDueDay, months * index),
    amount: index === count - 1 ? total - each * (count - 1) : each,
  }));
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

/** Days from a key date an alert goes out before or on it. */
export const KEY_DATE_OFFSETS = [-7, -1, 0];

/**
 * Days after a key date passes, with the issue still open and no later
 * date set, that the owner is asked to finalise it or set the next date.
 */
export const FINALISE_OFFSETS = [1, 8];

/** An open issue with nothing coming up is raised again this often. */
export const QUIET_AFTER_DAYS = 90;

/** How often an opted-in leasehold property gets a freehold check-in. */
export const FREEHOLD_CHECK_MONTHS = 6;

export type IssueAlertKind = "KEY_DATE" | "FINALISE" | "QUIET";

export interface IssueAlert {
  kind: IssueAlertKind;
  /**
   * Stable for this alert whatever day it's queued on, so a run that
   * catches up yesterday's alert can't queue it twice.
   */
  key: string;
  /** The key date it's about (not set for QUIET). */
  keyDate?: { id: string; label: string; day: CalendarDay };
  /** How far today is from that date (negative = still ahead). */
  offsetDays?: number;
  /** For QUIET: days since anyone last changed the issue. */
  quietDays?: number;
}

export interface IssueForAlerts {
  keyDates: { id: string; label: string; day: CalendarDay; done: boolean }[];
  /** The day the issue was last changed. */
  lastActivityDay: CalendarDay;
  /** Whether it has unpaid dues (which send their own reminders). */
  hasOpenDues: boolean;
}

/**
 * Today's slot among `slots`, or else yesterday's, in case it was never
 * queued (the job didn't run that day). The alert's key uses the slot, so
 * queueing yesterday's again is a no-op.
 */
function slotFor(offsetDays: number, slots: number[]) {
  if (slots.includes(offsetDays)) return offsetDays;
  if (slots.includes(offsetDays - 1)) return offsetDays - 1;
  return null;
}

/**
 * The alerts an open issue is owed on `today`:
 *
 * - KEY_DATE: a key date is 7 days away, tomorrow or today.
 * - FINALISE: the latest key date passed (1 and 8 days ago) and nothing
 *   later is set. Setting a next date, or ticking this one done, stops it.
 * - QUIET: no key date ahead, no unpaid dues, and nobody has changed the
 *   issue for 90 days (and every 90 days after).
 */
export function issueAlertsFor(
  issue: IssueForAlerts,
  today: CalendarDay,
): IssueAlert[] {
  const alerts: IssueAlert[] = [];
  const pending = issue.keyDates.filter((keyDate) => !keyDate.done);
  const upcoming = pending.filter((keyDate) => keyDate.day >= today);

  for (const keyDate of upcoming) {
    const offsetDays = daysBetween(keyDate.day, today);
    const slot = slotFor(offsetDays, KEY_DATE_OFFSETS);
    if (slot === null) continue;
    alerts.push({
      kind: "KEY_DATE",
      key: `${keyDate.id}:${slot}`,
      keyDate,
      offsetDays,
    });
  }

  if (upcoming.length === 0) {
    // Only the most recent passed date asks; older ones were superseded.
    const latest = pending
      .filter((keyDate) => keyDate.day < today)
      .sort((a, b) => (a.day < b.day ? 1 : -1))[0];
    if (latest) {
      const offsetDays = daysBetween(latest.day, today);
      const slot = slotFor(offsetDays, FINALISE_OFFSETS);
      if (slot !== null) {
        alerts.push({
          kind: "FINALISE",
          key: `${latest.id}:${slot}`,
          keyDate: latest,
          offsetDays,
        });
      }
    }

    if (!issue.hasOpenDues) {
      const quietDays = daysBetween(issue.lastActivityDay, today);
      const round = Math.floor(quietDays / QUIET_AFTER_DAYS);
      // On the 90th day (and each 90 after), or the day after if missed.
      if (round >= 1 && quietDays % QUIET_AFTER_DAYS <= 1) {
        alerts.push({
          kind: "QUIET",
          key: `quiet:${addDays(issue.lastActivityDay, round * QUIET_AFTER_DAYS)}`,
          quietDays,
        });
      }
    }
  }

  return alerts;
}

/**
 * Which six-monthly freehold check-in falls on `today` (or fell yesterday)
 * for a property that opted in on `since`: 1 for the first, six months
 * later. Null when none does.
 */
export function freeholdCheckRound(
  since: CalendarDay,
  today: CalendarDay,
): number | null {
  const yesterday = addDays(today, -1);
  for (let round = 1; round <= 400; round += 1) {
    const day = addMonthsClamped(since, FREEHOLD_CHECK_MONTHS * round);
    if (day === today || day === yesterday) return round;
    if (day > today) return null;
  }
  return null;
}

/** The next key date still ahead (or today), if any. */
export function nextKeyDate<T extends { date: Date; done: boolean }>(
  keyDates: T[],
  today: Date,
): T | undefined {
  return keyDates
    .filter((keyDate) => !keyDate.done && keyDate.date >= today)
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
}
