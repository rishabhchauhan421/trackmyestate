/**
 * Reminder schedule definitions shared by Settings (client and server) and
 * the reminder generator. A reminder is an offset in days from a bill's due
 * date: negative = before, 0 = the due day, positive = an overdue follow-up
 * (sent only while the bill is still unpaid).
 *
 * The defaults here apply to every user until they change a category in
 * Settings › Reminders; only changed categories are stored (as
 * `NotificationRule` rows), so improving a default here reaches everyone
 * who hasn't customised it.
 */
import type { EventCategory, ReminderChannel } from "../../generated/prisma";

/** Offsets offered as chips in Settings, in display order. */
export const REMINDER_OFFSET_PRESETS = [-30, -14, -7, -3, -1, 0, 1, 3, 7];

/** Upper bound per category, so a schedule can't turn into nagging. */
export const MAX_REMINDERS_PER_CATEGORY = 5;

/** Channels that can actually deliver today (see `notifications/registry`). */
export const LIVE_REMINDER_CHANNELS: ReminderChannel[] = ["EMAIL"];

export type ReminderCategoryConfig = {
  category: EventCategory;
  label: string;
  description: string;
  /** Money coming in (rent, payouts) — worded "expected"/"not received". */
  incoming: boolean;
  defaultOffsets: number[];
};

/** Every category a bill can have, with its built-in schedule. */
export const REMINDER_CATEGORIES: ReminderCategoryConfig[] = [
  {
    category: "UTILITY_BILL",
    label: "Utility bills",
    description: "Electricity, water, gas, internet, maintenance, tax",
    incoming: false,
    defaultOffsets: [-3, 0, 3],
  },
  {
    category: "EMI",
    label: "Loan EMIs",
    description: "Monthly instalments on your loans",
    incoming: false,
    defaultOffsets: [-3, 0],
  },
  {
    category: "PREMIUM",
    label: "Insurance premiums",
    description: "A missed premium can lapse the policy — reminded early",
    incoming: false,
    defaultOffsets: [-30, -7, -1, 1],
  },
  {
    category: "RENT",
    label: "Rent",
    description: "Rent you collect — and a nudge if it hasn't arrived",
    incoming: true,
    defaultOffsets: [0, 3],
  },
  {
    category: "PAYOUT",
    label: "Payouts & maturities",
    description: "Policy maturities and other money due to you",
    incoming: true,
    defaultOffsets: [-7, 0],
  },
  {
    category: "INVESTMENT_RETURN",
    label: "Investment returns",
    description: "FD maturities, dividends and other returns",
    incoming: true,
    defaultOffsets: [-7, 0],
  },
  {
    category: "CLAIM_SETTLEMENT",
    label: "Claim settlements",
    description: "Insurance claims you're waiting on",
    incoming: true,
    defaultOffsets: [0, 7],
  },
  {
    category: "CUSTOM",
    label: "Other",
    description: "Anything else you've added with a date",
    incoming: false,
    defaultOffsets: [-3, 0],
  },
];

export function reminderCategoryConfig(category: EventCategory) {
  return REMINDER_CATEGORIES.find((c) => c.category === category)!;
}

/** Chip label: "30 days before", "On the day", "3 days after". */
export function formatReminderOffset(offset: number) {
  if (offset === 0) return "On the day";
  const days = Math.abs(offset);
  const unit = days === 1 ? "day" : "days";
  return offset < 0 ? `${days} ${unit} before` : `${days} ${unit} after`;
}

/** Sorted, de-duplicated offsets. */
export function normalizeOffsets(offsets: number[]) {
  return [...new Set(offsets)].sort((a, b) => a - b);
}

export function sameOffsets(a: number[], b: number[]) {
  const x = normalizeOffsets(a);
  const y = normalizeOffsets(b);
  return x.length === y.length && x.every((value, i) => value === y[i]);
}
