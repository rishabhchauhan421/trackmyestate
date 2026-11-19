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
import { billPaidUrl } from "~/server/bills/paid-link";
import { guestOptOutUrl, recipientOptOutUrl } from "~/server/guests/opt-out";
import { enqueueNotificationJob } from "~/server/notifications/enqueue";
import { normalizeEmail } from "~/server/notifications/suppression";
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
 *
 * - A reminder that fell yesterday and was never queued (the job didn't
 *   run that day, or the bill is new) is queued today instead, worded for
 *   today, unless today has a reminder of its own.
 * - The owner's reminders also go to the other members of the bill's
 *   household.
 * - A run that runs out of time remembers where it stopped (`CronRun.cursor`)
 *   and the next one carries on from there, so every bill gets its turn.
 * - One bill that fails is logged and counted in `failed`; the rest carry on.
 */

/** Local hour reminders are sent at, unless the owner picked another. */
export const SEND_HOUR = 9;

export const BATCH_SIZE = 200;
export const TIME_BUDGET_MS = 240_000;

/**
 * How far around today to look: far enough to cover every offset a user
 * can pick, plus a day either side for time-zone differences (and one
 * more behind, for a reminder caught up a day late).
 */
const LOOKBACK_DAYS = Math.max(...REMINDER_OFFSET_PRESETS) + 2;
const LOOKAHEAD_DAYS = -Math.min(...REMINDER_OFFSET_PRESETS) + 1;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface GenerateRemindersSummary {
  scanned: number;
  queued: number;
  /** Bills that threw; they're retried on the next run. */
  failed: number;
  /** The first failure's message, for the job's health record. */
  firstError?: string;
  hasMore: boolean;
}

const JOB = "reminders";

export async function generateReminders(
  now = new Date(),
  { timeBudgetMs = TIME_BUDGET_MS, clock = () => Date.now() } = {},
): Promise<GenerateRemindersSummary> {
  const startedAt = clock();
  // Carry on from where the last run ran out of time, if it did.
  const resumeFrom =
    (await db.cronRun.findUnique({ where: { job: JOB } }))?.cursor ?? undefined;
  let cursor = resumeFrom;
  let scanned = 0;
  let queued = 0;
  let failed = 0;
  let firstError: string | undefined;
  let hasMore = false;

  for (;;) {
    const bills = await db.bill.findMany({
      where: {
        status: { in: [...OPEN_PAYMENT_STATUSES] },
        dueDate: {
          gte: new Date(now.getTime() - LOOKBACK_DAYS * DAY_MS),
          lte: new Date(now.getTime() + LOOKAHEAD_DAYS * DAY_MS),
        },
        ...(cursor ? { id: { gt: cursor } } : {}),
        ...NOT_SOFT_DELETED,
      },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
    });
    if (bills.length === 0) break;

    const batch = await queueRemindersForBills(bills, now);
    queued += batch.queued;
    failed += batch.failed;
    firstError ??= batch.firstError;
    scanned += bills.length;
    cursor = bills[bills.length - 1]!.id;

    if (bills.length < BATCH_SIZE) break;
    if (clock() - startedAt >= timeBudgetMs) {
      hasMore = true;
      break;
    }
  }

  const nextCursor = hasMore ? cursor : undefined;
  if (nextCursor !== resumeFrom) {
    await db.cronRun.upsert({
      where: { job: JOB },
      create: { job: JOB, cursor: nextCursor ?? null },
      update: { cursor: nextCursor ?? null },
    });
  }

  return { scanned, queued, failed, firstError, hasMore };
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

  const householdIds = [
    ...new Set(bills.flatMap((b) => (b.householdId ? [b.householdId] : []))),
  ];

  const [owners, remindersFor, schedules, members] = await Promise.all([
    db.user.findMany({
      where: { id: { in: ownerIds } },
      select: {
        id: true,
        name: true,
        email: true,
        timezone: true,
        reminderHour: true,
        currency: true,
      },
    }),
    getEffectiveRemindersForOwners(ownerIds),
    scheduleIds.length
      ? db.billSchedule.findMany({
          where: { id: { in: scheduleIds } },
          select: { id: true, recipients: true },
        })
      : Promise.resolve([]),
    householdIds.length
      ? db.householdMember.findMany({
          where: { householdId: { in: householdIds } },
          select: { householdId: true, userId: true },
        })
      : Promise.resolve([]),
  ]);
  const ownerById = new Map(owners.map((owner) => [owner.id, owner]));
  // The other people in these bills' households, who get the owner's
  // reminders too.
  const otherMemberIds = [
    ...new Set(members.map((member) => member.userId)),
  ].filter((id) => !ownerById.has(id));
  const otherMembers = otherMemberIds.length
    ? await db.user.findMany({
        where: { id: { in: otherMemberIds } },
        select: { id: true, email: true },
      })
    : [];
  const memberEmail = new Map(
    [...owners, ...otherMembers].map((user) => [user.id, user.email]),
  );
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

  // Addresses that unsubscribed from an owner's emails, or from everyone's.
  const candidateEmails = [
    ...guests.flatMap((guest) => (guest.email ? [guest.email] : [])),
    ...schedules.flatMap((s) => (s.recipients ?? []).map((r) => r.email)),
  ].map(normalizeEmail);
  const suppressions = candidateEmails.length
    ? await db.emailSuppression.findMany({
        where: { email: { in: [...new Set(candidateEmails)] } },
        select: { email: true, ownerId: true },
      })
    : [];
  const suppressed = (email: string, ownerId: string) =>
    suppressions.some(
      (row) =>
        row.email === normalizeEmail(email) &&
        (row.ownerId === null || row.ownerId === ownerId),
    );

  let queued = 0;
  let failed = 0;
  let firstError: string | undefined;
  for (const bill of bills) {
    try {
      await queueRemindersForBill(bill);
    } catch (error) {
      // One bad bill must not stop the others; it's retried next run.
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      firstError ??= `Bill ${bill.id}: ${message}`;
      console.error(`[reminders] Bill ${bill.id} failed`, error);
    }
  }
  return { queued, failed, firstError };

  async function queueRemindersForBill(bill: BillForReminder) {
    const owner = ownerById.get(bill.ownerId);
    if (!owner) return;

    const timeZone = resolveTimeZone(owner.timezone);
    const today = todayInTimeZone(timeZone, now);
    // `dueDate` is a date-only value (see `~/lib/calendar-day`): its day
    // is fixed. Only "today" depends on the owner's time zone.
    const dueDay = calendarDayOf(bill.dueDate);
    const offsetDays = daysBetween(dueDay, today);

    const reminders = remindersFor(owner.id, bill.category);
    const billGuests = guests.filter(
      (guest) =>
        guest.ownerId === owner.id &&
        guest.categories.includes(bill.category) &&
        (guest.propertyIds.length === 0 ||
          (bill.propertyId !== null &&
            guest.propertyIds.includes(bill.propertyId))),
    );
    // Whether anyone is reminded at `slot` days from the due date: the
    // owner's schedule says so, or it's the due day and a guest is
    // reminded only then.
    const remindsAt = (slot: number) =>
      reminders.some((reminder) => reminder.offsetDays === slot) ||
      (slot === 0 && billGuests.some((guest) => guest.dueDayOnly));
    // Today's reminder — or else yesterday's, in case it was never queued
    // (the idempotency key below makes that a no-op when it was).
    const slot = remindsAt(offsetDays)
      ? offsetDays
      : remindsAt(offsetDays - 1)
        ? offsetDays - 1
        : null;
    if (slot === null) return;

    const matching = reminders.filter(
      (reminder) => reminder.offsetDays === slot,
    );
    // Guests reminded about this bill now: on the owner's schedule, or
    // only on the due day if that's how they were added.
    const guestsToday = billGuests.filter((guest) =>
      guest.dueDayOnly ? slot === 0 : matching.length > 0,
    );
    if (matching.length === 0 && guestsToday.length === 0) return;

    // People added to this utility who want due reminders (the older,
    // per-utility recipients; Guests are the newer, app-wide version).
    const utilityRecipients = bill.billScheduleId
      ? (scheduleById.get(bill.billScheduleId)?.recipients ?? [])
          .filter((recipient) => recipient.notifyOnDue)
          .map((recipient) => recipient.email)
          .filter((email) => !suppressed(email, owner.id))
      : [];

    const incoming = reminderCategoryConfig(bill.category).incoming;
    const { title, body } = reminderMessage({
      name: bill.description ?? EVENT_CATEGORY_LABELS[bill.category],
      // What's still owed, for a bill that's been part-paid.
      amount:
        bill.status === "PARTIALLY_PAID"
          ? Math.max(bill.amount - (bill.paidAmount ?? 0), 0)
          : bill.amount,
      dueDay,
      offsetDays,
      incoming,
      currency: bill.currency ?? owner.currency,
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
    // Keyed by the reminder's slot, not today's offset, so one caught up a
    // day late can't be queued twice.
    const keyPrefix = `reminder:${bill.id}:DUE_DATE:${slot}:EMAIL`;

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
      // The owner, then everyone else in the bill's household: they can
      // all see and settle it, so they all get the owner's version.
      const householdEmails = members
        .filter(
          (member) =>
            member.householdId === bill.householdId &&
            member.userId !== owner.id,
        )
        .flatMap((member) => {
          const email = memberEmail.get(member.userId);
          return email ? [email] : [];
        });
      for (const email of [owner.email, ...householdEmails]) {
        if (!claim(email)) continue;
        await enqueue({
          ...base,
          channel: "EMAIL",
          recipient: email,
          body,
          // One click settles it without signing in; only people with
          // access to the bill get this link.
          metadata: {
            actionUrl: billPaidUrl(bill.id),
            actionLabel: incoming ? "Mark received" : "Mark paid",
            secondaryActionUrl: actionUrlFor(bill),
            secondaryActionLabel: "View in TrackMyEstate",
          },
          idempotencyKey: `${keyPrefix}:${email}`,
        });
      }
      for (const email of utilityRecipients) {
        if (!claim(email)) continue;
        await enqueue({
          ...base,
          channel: "EMAIL",
          recipient: email,
          body: sharedBody,
          // No link into the app (they have no account): a stop link.
          metadata: {
            actionUrl: recipientOptOutUrl(owner.id, email),
            actionLabel: "Stop these reminders",
            thirdParty: true,
          },
          idempotencyKey: `${keyPrefix}:${email}`,
        });
      }
    }

    // Guests, in the owner's name, with a stop link instead of a link into
    // the app. `guestId` lets the sender cancel the job if the guest stops
    // or is paused before it goes out.
    for (const guest of guestsToday) {
      if (!guest.email || !guest.channels.includes("EMAIL")) continue;
      if (suppressed(guest.email, owner.id)) continue;
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
          thirdParty: true,
        },
        idempotencyKey: `${keyPrefix}:guest:${guest.id}`,
      });
    }
  }
}

/** The bill's page in the app (sign-in required). */
function actionUrlFor(bill: BillForReminder) {
  return `${env.NEXT_PUBLIC_SITE_URL}/bills/${bill.id}`;
}
