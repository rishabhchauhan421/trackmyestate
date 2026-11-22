import "server-only";

import { env } from "~/env";
import { calendarDayOf } from "~/lib/calendar-day";
import {
  freeholdCheckRound,
  issueAlertsFor,
  type IssueAlert,
} from "~/lib/issues";
import { ISSUE_TYPE_LABELS } from "~/lib/labels";
import {
  resolveTimeZone,
  todayInTimeZone,
  zonedTimeToUtc,
} from "~/lib/time-zone";
import { db } from "~/server/db";
import { enqueueNotificationJob } from "~/server/notifications/enqueue";
import { OPEN_PAYMENT_STATUSES } from "~/server/queries/shared";
import { SEND_HOUR } from "~/server/reminders/generate";

/**
 * Queues the alerts property issues are owed today, as `NotificationJob`s
 * the existing `/api/cron/notifications` drain sends. Runs after the bill
 * reminders in the hourly `/api/cron/reminders` job.
 *
 * Unpaid dues under an issue are bills, so the bill reminders already
 * cover them. This covers what has no bill:
 *
 * - a key date coming up, and "Finalise this?" once it has passed;
 * - an open issue that has gone quiet;
 * - the optional six-monthly freehold check-in on a leasehold property.
 *
 * Which of these fall on a given day is decided by `~/lib/issues`. Like
 * the bill reminders, "today" is the owner's, the email goes out at their
 * reminder hour, the other members of the household get it too, and every
 * job has an idempotency key so running hourly never queues a duplicate.
 * Guests are never sent these: an issue is the household's own business.
 */

export interface GenerateIssueAlertsSummary {
  /** Open issues and opted-in properties looked at. */
  scanned: number;
  queued: number;
  failed: number;
  firstError?: string;
}

function formatDay(day: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

const plural = (days: number) => `${days} ${days === 1 ? "day" : "days"}`;

/** The email's subject and body for one alert on an issue. */
export function issueAlertMessage(
  alert: IssueAlert,
  issue: { title: string; propertyName: string },
) {
  const about = `${issue.title} (${issue.propertyName})`;
  if (alert.kind === "QUIET") {
    return {
      title: `${about}: still open, no update in ${plural(alert.quietDays ?? 0)}`,
      body: `Nothing has changed on this issue for ${plural(alert.quietDays ?? 0)} and it has no date or payment coming up.\nAdd the next date or a note, or mark it resolved if it's settled.`,
    };
  }
  const { label, day } = alert.keyDate!;
  const offset = alert.offsetDays ?? 0;
  if (alert.kind === "FINALISE") {
    return {
      title: `${about}: is this finalised?`,
      body: `${label} was on ${formatDay(day)}.\nMark the issue resolved if it's settled, or set the next date and we'll remind you again.`,
    };
  }
  const when =
    offset < 0
      ? `in ${plural(-offset)}`
      : offset === 0
        ? "today"
        : `${plural(offset)} ago`;
  return {
    title: `${about}: ${label} ${when}`,
    body: `${label} is on ${formatDay(day)}.`,
  };
}

export async function generateIssueAlerts(
  now = new Date(),
): Promise<GenerateIssueAlertsSummary> {
  let queued = 0;
  let failed = 0;
  let firstError: string | undefined;

  const [issues, leaseholdRows] = await Promise.all([
    db.propertyIssue.findMany({ where: { status: "OPEN" } }),
    db.property.findMany({
      where: {
        ownershipType: "LEASEHOLD",
        freeholdAlertsSince: { not: null },
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        householdId: true,
        freeholdAlertsSince: true,
      },
    }),
  ]);
  const leaseholds = leaseholdRows.filter(
    (property) => property.freeholdAlertsSince,
  );
  // Issues on a deleted property are skipped (reads leave deleted rows out;
  // see `~/server/soft-delete`).
  const issueProperties = issues.length
    ? await db.property.findMany({
        where: { id: { in: [...new Set(issues.map((i) => i.propertyId))] } },
        select: { id: true, name: true },
      })
    : [];
  const propertyName = new Map(issueProperties.map((p) => [p.id, p.name]));
  const liveIssues = issues.filter((issue) =>
    propertyName.has(issue.propertyId),
  );

  const ownerIds = [
    ...new Set([
      ...liveIssues.map((issue) => issue.ownerId),
      ...leaseholds.map((property) => property.ownerId),
    ]),
  ];
  const householdIds = [
    ...new Set([
      ...liveIssues.map((issue) => issue.householdId),
      ...leaseholds.flatMap((p) => (p.householdId ? [p.householdId] : [])),
    ]),
  ];
  if (ownerIds.length === 0) return { scanned: 0, queued, failed };

  const [owners, members, openDues] = await Promise.all([
    db.user.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, email: true, timezone: true, reminderHour: true },
    }),
    db.householdMember.findMany({
      where: { householdId: { in: householdIds } },
      select: { householdId: true, userId: true },
    }),
    liveIssues.length
      ? db.bill.findMany({
          where: {
            propertyIssueId: { in: liveIssues.map((issue) => issue.id) },
            status: { in: [...OPEN_PAYMENT_STATUSES] },
          },
          select: { propertyIssueId: true },
        })
      : Promise.resolve([]),
  ]);
  const ownerById = new Map(owners.map((owner) => [owner.id, owner]));
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
  const issuesWithDues = new Set(openDues.map((bill) => bill.propertyIssueId));

  /** When to send, and to whom: the owner first, then the household. */
  const delivery = (ownerId: string, householdId: string | null) => {
    const owner = ownerById.get(ownerId);
    if (!owner) return null;
    const timeZone = resolveTimeZone(owner.timezone);
    const today = todayInTimeZone(timeZone, now);
    const emails = [
      owner.email,
      ...members
        .filter((member) => member.householdId === householdId)
        .flatMap((member) => {
          const email = memberEmail.get(member.userId);
          return email ? [email] : [];
        }),
    ];
    return {
      today,
      scheduledFor: zonedTimeToUtc(
        today,
        owner.reminderHour ?? SEND_HOUR,
        0,
        timeZone,
      ),
      recipients: [...new Set(emails.map((email) => email.toLowerCase()))],
    };
  };

  const record = (what: string, error: unknown) => {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    firstError ??= `${what}: ${message}`;
    console.error(`[issue-alerts] ${what} failed`, error);
  };

  for (const issue of liveIssues) {
    try {
      const send = delivery(issue.ownerId, issue.householdId);
      const name = propertyName.get(issue.propertyId);
      if (!send || !name) continue;
      const alerts = issueAlertsFor(
        {
          keyDates: issue.keyDates.map((keyDate) => ({
            id: keyDate.id,
            label: keyDate.label,
            day: calendarDayOf(keyDate.date),
            done: keyDate.done,
          })),
          lastActivityDay: todayInTimeZone("UTC", issue.lastActivityAt),
          hasOpenDues: issuesWithDues.has(issue.id),
        },
        send.today,
      );
      const url = `${env.NEXT_PUBLIC_SITE_URL}/properties/${issue.propertyId}/issues/${issue.id}`;
      for (const alert of alerts) {
        const { title, body } = issueAlertMessage(alert, {
          title: issue.title,
          propertyName: name,
        });
        for (const recipient of send.recipients) {
          const { created } = await enqueueNotificationJob({
            ownerId: issue.ownerId,
            category: "PROPERTY_DUE",
            channel: "EMAIL",
            recipient,
            title,
            body: `${ISSUE_TYPE_LABELS[issue.type]} · ${name}\n${body}`,
            scheduledFor: send.scheduledFor,
            propertyId: issue.propertyId,
            propertyIssueId: issue.id,
            metadata:
              alert.kind === "KEY_DATE"
                ? { actionUrl: url, actionLabel: "View the issue" }
                : {
                    actionUrl: `${url}/resolve`,
                    actionLabel: "Mark resolved",
                    secondaryActionUrl: url,
                    secondaryActionLabel:
                      alert.kind === "FINALISE"
                        ? "Set the next date"
                        : "Update the issue",
                  },
            idempotencyKey: `issue:${issue.id}:${alert.key}:EMAIL:${recipient}`,
          });
          if (created) queued += 1;
        }
      }
    } catch (error) {
      record(`Issue ${issue.id}`, error);
    }
  }

  // Freehold check-ins: only while no conversion is being tracked (once an
  // open freehold issue exists, its own dates and dues do the reminding).
  const converting = new Set(
    liveIssues
      .filter((issue) => issue.type === "FREEHOLD_CONVERSION")
      .map((issue) => issue.propertyId),
  );
  for (const property of leaseholds) {
    try {
      if (converting.has(property.id) || !property.freeholdAlertsSince) {
        continue;
      }
      const send = delivery(property.ownerId, property.householdId);
      if (!send) continue;
      const round = freeholdCheckRound(
        calendarDayOf(property.freeholdAlertsSince),
        send.today,
      );
      if (round === null) continue;
      const url = `${env.NEXT_PUBLIC_SITE_URL}/properties/${property.id}`;
      for (const recipient of send.recipients) {
        const { created } = await enqueueNotificationJob({
          ownerId: property.ownerId,
          category: "PROPERTY_DUE",
          channel: "EMAIL",
          recipient,
          title: `${property.name}: time to look at freehold conversion?`,
          body: `${property.name} is still leasehold.\nIf you've started converting it to freehold, add it as an issue to track the dates and charges. You can switch these check-ins off on the property's page.`,
          scheduledFor: send.scheduledFor,
          propertyId: property.id,
          metadata: {
            actionUrl: `${url}/issues/new?type=FREEHOLD_CONVERSION`,
            actionLabel: "Track the conversion",
            secondaryActionUrl: url,
            secondaryActionLabel: "View the property",
          },
          idempotencyKey: `freehold:${property.id}:${calendarDayOf(property.freeholdAlertsSince)}:${round}:EMAIL:${recipient}`,
        });
        if (created) queued += 1;
      }
    } catch (error) {
      record(`Property ${property.id}`, error);
    }
  }

  return {
    scanned: liveIssues.length + leaseholds.length,
    queued,
    failed,
    firstError,
  };
}
