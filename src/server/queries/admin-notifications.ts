import "server-only";

import type { Prisma } from "../../../generated/prisma";
import { db } from "~/server/db";

/**
 * Admin › Notifications: every `NotificationJob` across all users — what
 * was queued, sent, skipped, cancelled or failed, and why.
 */

export const LOG_PAGE_SIZE = 25;

/** The channels the log filters by (push isn't offered yet). */
export const LOG_CHANNELS = ["EMAIL", "SMS", "WHATSAPP"] as const;
export const LOG_STATUSES = [
  "SENT",
  "SCHEDULED",
  "PROCESSING",
  "FAILED",
  "CANCELLED",
  "SKIPPED",
] as const;

export type LogChannel = (typeof LOG_CHANNELS)[number];
export type LogStatus = (typeof LOG_STATUSES)[number];

export type LogFilters = {
  channel?: LogChannel;
  status?: LogStatus;
  /** Matches the recipient or the subject, case-insensitively. */
  q?: string;
  /** 1-based. */
  page?: number;
};

/** Who a notification went to, relative to the account that owns it. */
export type RecipientRole = "owner" | "guest" | "recipient";

function filterWhere({
  status,
  q,
}: LogFilters): Prisma.NotificationJobWhereInput {
  const search = q?.trim();
  return {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { recipient: { contains: search, mode: "insensitive" } },
            { title: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export async function getNotificationLog(filters: LogFilters = {}) {
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const base = filterWhere(filters);
  const where: Prisma.NotificationJobWhereInput = {
    ...base,
    ...(filters.channel ? { channel: filters.channel } : {}),
  };

  const [jobs, total, ...channelCounts] = await Promise.all([
    db.notificationJob.findMany({
      where,
      orderBy: { scheduledFor: "desc" },
      skip: (page - 1) * LOG_PAGE_SIZE,
      take: LOG_PAGE_SIZE,
    }),
    db.notificationJob.count({ where }),
    // Tab counts honour the status/search filters, not the channel one.
    db.notificationJob.count({ where: base }),
    ...LOG_CHANNELS.map((channel) =>
      db.notificationJob.count({ where: { ...base, channel } }),
    ),
  ]);

  const ownerIds = [...new Set(jobs.map((job) => job.ownerId))];
  const owners = ownerIds.length
    ? await db.user.findMany({
        where: { id: { in: ownerIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const ownerById = new Map(owners.map((owner) => [owner.id, owner]));

  return {
    rows: jobs.map((job) => {
      const owner = ownerById.get(job.ownerId);
      return {
        ...job,
        ownerName: owner?.name ?? null,
        recipientRole: recipientRole(job, owner?.email),
      };
    }),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / LOG_PAGE_SIZE)),
    counts: Object.fromEntries([
      ["ALL", channelCounts[0]],
      ...LOG_CHANNELS.map((channel, i) => [channel, channelCounts[i + 1]]),
    ]) as Record<"ALL" | LogChannel, number>,
  };
}

/** Headline numbers for the top of the log. */
export async function getNotificationLogStats(now = new Date()) {
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000);
  const [sent24h, queued, cancelled7d, failed7d] = await Promise.all([
    db.notificationJob.count({
      where: { status: "SENT", sentAt: { gte: ago(1) } },
    }),
    db.notificationJob.count({
      where: { status: "SCHEDULED", scheduledFor: { gt: now } },
    }),
    db.notificationJob.count({
      where: { status: "CANCELLED", updatedAt: { gte: ago(7) } },
    }),
    db.notificationJob.count({
      where: { status: "FAILED", updatedAt: { gte: ago(7) } },
    }),
  ]);
  return { sent24h, queued, cancelled7d, failed7d };
}

/** One notification with its owner, bill and guest, for the detail page. */
export async function getNotificationDetail(jobId: string) {
  const job = await db.notificationJob.findUnique({ where: { id: jobId } });
  if (!job) return null;

  const metadata = (job.metadata ?? {}) as { guestId?: unknown };
  const guestId =
    typeof metadata.guestId === "string" ? metadata.guestId : null;

  const [owner, bill, guest] = await Promise.all([
    db.user.findUnique({
      where: { id: job.ownerId },
      select: { id: true, name: true, email: true, timezone: true },
    }),
    job.billId
      ? db.bill.findUnique({
          where: { id: job.billId },
          select: {
            id: true,
            description: true,
            amount: true,
            dueDate: true,
            status: true,
            propertyId: true,
            category: true,
          },
        })
      : null,
    guestId
      ? db.guest.findUnique({
          where: { id: guestId },
          select: { id: true, name: true, optedOutAt: true, pausedAt: true },
        })
      : null,
  ]);

  return {
    job,
    owner,
    bill,
    guest,
    recipientRole: recipientRole(job, owner?.email),
  };
}

function recipientRole(
  job: { recipient: string; metadata: Prisma.JsonValue },
  ownerEmail: string | undefined,
): RecipientRole {
  const metadata = (job.metadata ?? {}) as { guestId?: unknown };
  if (typeof metadata.guestId === "string") return "guest";
  if (job.recipient.toLowerCase() === ownerEmail?.toLowerCase()) {
    return "owner";
  }
  return "recipient";
}
