import "server-only";

import { env } from "~/env";
import { calendarDayOf } from "~/lib/calendar-day";
import { EVENT_CATEGORY_LABELS } from "~/lib/labels";
import {
  REMINDER_OFFSET_PRESETS,
  reminderCategoryConfig,
} from "~/lib/reminders";
import {
  daysBetween,
  resolveTimeZone,
  todayInTimeZone,
  zonedTimeToUtc,
} from "~/lib/time-zone";
import { db } from "~/server/db";
import { guestOptOutUrl } from "~/server/guests/opt-out";
import { enqueueNotificationJob } from "~/server/notifications/enqueue";
import {
  NOT_SOFT_DELETED,
  OPEN_PAYMENT_STATUSES,
} from "~/server/queries/shared";
import { reminderMessage } from "./message";
import { getEffectiveRemindersForOwners } from "./rules";

/**
 * Turns reminder rules into queued `NotificationJob`s — the reminder
 * system's write side. Run hourly by `/api/cron/reminders`; the existing
 * `/api/cron/notifications` drain sends what it queues.
 *
 * For each unpaid bill near its due date, it works out how many days today
 * is from the due date *in the owner's time zone*, and queues a job for
 * every reminder whose `offsetDays` matches, scheduled for `SEND_HOUR`
 * local time. Every job has an idempotency key, so running more often than
 * daily (or re-running after a failure) never queues a duplicate. Paid
 * bills are never selected, and a bill paid after its job was queued is
 * cancelled at send time (see `dispatchNotificationJob`).
 */

/** Local hour reminders are sent at, unless the owner picked another. */
export const SEND_HOUR = 9;

export const BATCH_SIZE = 200;
export const TIME_BUDGET_MS = 45_000;

/**
 * How far around today to look: far enough to cover every offset a user
 * can pick, plus a day either side for time-zone differences.
 */
const LOOKBACK_DAYS = Math.max(...REMINDER_OFFSET_PRESETS) + 1;
const LOOKAHEAD_DAYS = -Math.min(...REMINDER_OFFSET_PRESETS) + 1;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface GenerateRemindersSummary {
  scanned: number;
  queued: number;
  hasMore: boolean;
}

export async function generateReminders(
  now = new Date(),
  { timeBudgetMs = TIME_BUDGET_MS, clock = () => Date.now() } = {},
): Promise<GenerateRemindersSummary> {
  const startedAt = clock();
  let cursor: string | undefined;
  let scanned = 0;
  let queued = 0;
  let hasMore = false;

  for (;;) {
    const bills = await db.bill.findMany({
      where: {
        status: { in: [...OPEN_PAYMENT_STATUSES] },
        dueDate: {
          gte: new Date(now.getTime() - LOOKBACK_DAYS * DAY_MS),
          lte: new Date(now.getTime() + LOOKAHEAD_DAYS * DAY_MS),
        },
        ...NOT_SOFT_DELETED,
      },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (bills.length === 0) break;

    queued += await queueRemindersForBills(bills, now);
    scanned += bills.length;
    cursor = bills[bills.length - 1]!.id;

    if (bills.length < BATCH_SIZE) break;
    if (clock() - startedAt >= timeBudgetMs) {
      hasMore = true;
      break;
    }
  }

  return { scanned, queued, hasMore };
}

type BillForReminder = Awaited<ReturnType<typeof db.bill.findMany>>[number];

async function queueRemindersForBills(bills: BillForReminder[], now: Date) {
  const ownerIds = [...new Set(bills.map((bill) => bill.ownerId))];
  const scheduleIds = [
    ...new Set(
      bills
        .filter((bill) => bill.category === "UTILITY_BILL")
        .flatMap((bill) => (bill.billScheduleId ? [bill.billScheduleId] : [])),
    ),
  ];

  const [owners, remindersFor, schedules] = await Promise.all([
    db.user.findMany({
      where: { id: { in: ownerIds } },
      select: {
        id: true,
        name: true,
        email: true,
        timezone: true,
        reminderHour: true,
      },
    }),
    getEffectiveRemindersForOwners(ownerIds),
    scheduleIds.length
      ? db.billSchedule.findMany({
          where: { id: { in: scheduleIds } },
          select: { id: true, recipients: true },
        })
      : Promise.resolve([]),
  ]);
  const ownerById = new Map(owners.map((owner) => [owner.id, owner]));
  const scheduleById = new Map(schedules.map((s) => [s.id, s]));
  const guests = await db.guest.findMany({
    where: {
      ownerId: { in: ownerIds },
      ...NOT_SOFT_DELETED,
      AND: [
        { OR: [{ pausedAt: null }, { pausedAt: { isSet: false } }] },
        { OR: [{ optedOutAt: null }, { optedOutAt: { isSet: false } }] },
      ],
    },
  });

  let queued = 0;
  for (const bill of bills) {
    const owner = ownerById.get(bill.ownerId);
    if (!owner) continue;

    const timeZone = resolveTimeZone(owner.timezone);
    const today = todayInTimeZone(timeZone, now);
    // `dueDate` is a date-only value (see `~/lib/calendar-day`): its day
    // is fixed. Only "today" depends on the owner's time zone.
    const dueDay = calendarDayOf(bill.dueDate);
    const offsetDays = daysBetween(dueDay, today);

    const matching = remindersFor(owner.id, bill.category).filter(
      (reminder) => reminder.offsetDays === offsetDays,
    );
    // Guests reminded about this bill today: on the owner's schedule, or
    // only on the due day if that's how they were added.
    const guestsToday = guests.filter(
      (guest) =>
        guest.ownerId === owner.id &&
        guest.categories.includes(bill.category) &&
        (guest.propertyIds.length === 0 ||
          (bill.propertyId !== null &&
            guest.propertyIds.includes(bill.propertyId))) &&
        (guest.dueDayOnly ? offsetDays === 0 : matching.length > 0),
    );
    if (matching.length === 0 && guestsToday.length === 0) continue;

    // People added to this utility who want due reminders (the older,
    // per-utility recipients; Guests are the newer, app-wide version).
    const utilityRecipients = bill.billScheduleId
      ? (scheduleById.get(bill.billScheduleId)?.recipients ?? [])
          .filter((recipient) => recipient.notifyOnDue)
          .map((recipient) => recipient.email)
      : [];

    const { title, body } = reminderMessage({
      name: bill.description ?? EVENT_CATEGORY_LABELS[bill.category],
      amount: bill.amount,
      dueDay,
      offsetDays,
      incoming: reminderCategoryConfig(bill.category).incoming,
    });
    // What anyone other than the owner sees: who it's from, and only the
    // item, amount and due date (no "mark it paid" — they have no account).
    const sharedBody = `From ${owner.name}, via TrackMyEstate.\n${body.split("\n")[0]}`;
    const scheduledFor = zonedTimeToUtc(
      today,
      owner.reminderHour ?? SEND_HOUR,
      0,
      timeZone,
    );
    const base = {
      ownerId: bill.ownerId,
      category: bill.category,
      title,
      scheduledFor,
      billId: bill.id,
      billScheduleId: bill.billScheduleId ?? undefined,
      propertyId: bill.propertyId ?? undefined,
      leaseId: bill.leaseId ?? undefined,
      loanId: bill.loanId ?? undefined,
      policyId: bill.policyId ?? undefined,
      investmentId: bill.investmentId ?? undefined,
    };
    const keyPrefix = `reminder:${bill.id}:DUE_DATE:${offsetDays}:EMAIL`;

    // Each address gets at most one email per reminder, whoever it belongs
    // to (an owner who is also a utility recipient, a guest added twice…).
    const emailed = new Set<string>();
    const claim = (email: string) => {
      const normalized = email.trim().toLowerCase();
      if (emailed.has(normalized)) return false;
      emailed.add(normalized);
      return true;
    };
    const enqueue = async (
      job: Parameters<typeof enqueueNotificationJob>[0],
    ) => {
      const { created } = await enqueueNotificationJob(job);
      if (created) queued += 1;
    };

    // Only email can be delivered today; SMS/WhatsApp need a provider.
    const ownerWantsEmail = matching.some((reminder) =>
      reminder.channels.includes("EMAIL"),
    );
    if (ownerWantsEmail) {
      if (claim(owner.email)) {
        await enqueue({
          ...base,
          channel: "EMAIL",
          recipient: owner.email,
          body,
          metadata: { actionUrl: actionUrlFor(bill) },
          idempotencyKey: `${keyPrefix}:${owner.email}`,
        });
      }
      for (const email of utilityRecipients) {
        if (!claim(email)) continue;
        await enqueue({
          ...base,
          channel: "EMAIL",
          recipient: email,
          body: sharedBody,
          // No button: recipients have no account to open.
          metadata: { actionUrl: null },
          idempotencyKey: `${keyPrefix}:${email}`,
        });
      }
    }

    // Guests, in the owner's name, with a stop link instead of a link into
    // the app. `guestId` lets the sender cancel the job if the guest stops
    // or is paused before it goes out.
    for (const guest of guestsToday) {
      if (!guest.email || !guest.channels.includes("EMAIL")) continue;
      if (!claim(guest.email)) continue;
      await enqueue({
        ...base,
        channel: "EMAIL",
        recipient: guest.email,
        body: sharedBody,
        metadata: {
          actionUrl: guestOptOutUrl(guest.id),
          actionLabel: "Stop these reminders",
          guestId: guest.id,
        },
        idempotencyKey: `${keyPrefix}:guest:${guest.id}`,
      });
    }
  }
  return queued;
}

/** Where the reminder's button takes you. */
function actionUrlFor(bill: BillForReminder) {
  const base = env.NEXT_PUBLIC_SITE_URL;
  if (bill.category === "UTILITY_BILL" && bill.propertyId) {
    return `${base}/properties/${bill.propertyId}/utilities/bills/${bill.id}`;
  }
  return `${base}/timeline`;
}
