import "server-only";

import { env } from "~/env";
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

/** Local hour reminders are sent at. */
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
      select: { id: true, email: true, timezone: true },
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

  let queued = 0;
  for (const bill of bills) {
    const owner = ownerById.get(bill.ownerId);
    if (!owner) continue;

    const timeZone = resolveTimeZone(owner.timezone);
    const today = todayInTimeZone(timeZone, now);
    const dueDay = todayInTimeZone(timeZone, bill.dueDate);
    const offsetDays = daysBetween(dueDay, today);

    const matching = remindersFor(owner.id, bill.category).filter(
      (reminder) => reminder.offsetDays === offsetDays,
    );
    if (matching.length === 0) continue;

    // The owner, plus anyone added to the utility who wants due reminders.
    const emails = [
      owner.email,
      ...(bill.billScheduleId
        ? (scheduleById.get(bill.billScheduleId)?.recipients ?? [])
            .filter((recipient) => recipient.notifyOnDue)
            .map((recipient) => recipient.email)
        : []),
    ];

    const { title, body } = reminderMessage({
      name: bill.description ?? EVENT_CATEGORY_LABELS[bill.category],
      amount: bill.amount,
      dueDay,
      offsetDays,
      incoming: reminderCategoryConfig(bill.category).incoming,
    });
    const scheduledFor = zonedTimeToUtc(today, SEND_HOUR, 0, timeZone);

    for (const reminder of matching) {
      for (const channel of reminder.channels) {
        // Only email can be addressed today; other channels need a phone
        // number or device, which users can't add yet.
        if (channel !== "EMAIL") continue;
        for (const recipient of new Set(emails)) {
          await enqueueNotificationJob({
            ownerId: bill.ownerId,
            category: bill.category,
            channel,
            recipient,
            title,
            body,
            scheduledFor,
            billId: bill.id,
            billScheduleId: bill.billScheduleId ?? undefined,
            propertyId: bill.propertyId ?? undefined,
            leaseId: bill.leaseId ?? undefined,
            loanId: bill.loanId ?? undefined,
            policyId: bill.policyId ?? undefined,
            investmentId: bill.investmentId ?? undefined,
            metadata: { actionUrl: actionUrlFor(bill) },
            idempotencyKey: `reminder:${bill.id}:DUE_DATE:${reminder.offsetDays}:${channel}:${recipient}`,
          });
          queued += 1;
        }
      }
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
