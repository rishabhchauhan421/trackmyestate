import "server-only";

import type { NotificationStatus } from "../../../generated/prisma";
import { db } from "~/server/db";
import { NOT_SOFT_DELETED } from "~/server/queries/shared";

const DAY_MS = 24 * 60 * 60 * 1000;

const NOTIFICATION_STATUSES: NotificationStatus[] = [
  "SCHEDULED",
  "PROCESSING",
  "SENT",
  "FAILED",
  "CANCELLED",
  "SKIPPED",
];

/**
 * Platform-wide numbers for the admin overview — unlike every other query in
 * `~/server/queries`, these are deliberately *not* scoped to one `ownerId`.
 * Gate any caller on `isAdmin()` (see `~/server/better-auth/server`) before
 * calling this.
 */
export async function getAdminOverview() {
  const now = new Date();
  const in7Days = new Date(now.getTime() - 7 * DAY_MS);
  const in30Days = new Date(now.getTime() - 30 * DAY_MS);

  const [
    totalUsers,
    newUsers7d,
    newUsers30d,
    bannedUsers,
    propertyValue,
    investmentValue,
    loanOutstanding,
    propertyCount,
    investmentCount,
    loanCount,
    policyCount,
    documentCount,
    activeNotificationRules,
    notificationStatusCounts,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: in7Days } } }),
    db.user.count({ where: { createdAt: { gte: in30Days } } }),
    db.user.count({ where: { banned: true } }),
    db.property.aggregate({ _sum: { currentEstimatedValue: true } }),
    db.investment.aggregate({ _sum: { currentEstimatedValue: true } }),
    db.loan.aggregate({ _sum: { outstandingBalance: true } }),
    db.property.count(),
    db.investment.count(),
    db.loan.count(),
    db.policy.count(),
    db.document.count(),
    db.notificationRule.count({ where: { active: true } }),
    Promise.all(
      NOTIFICATION_STATUSES.map((status) =>
        db.notificationJob.count({ where: { status } }),
      ),
    ),
  ]);

  const trackedValue =
    (propertyValue._sum.currentEstimatedValue ?? 0) +
    (investmentValue._sum.currentEstimatedValue ?? 0) -
    (loanOutstanding._sum.outstandingBalance ?? 0);

  return {
    users: {
      total: totalUsers,
      new7d: newUsers7d,
      new30d: newUsers30d,
      banned: bannedUsers,
    },
    trackedValue,
    assetCounts: {
      properties: propertyCount,
      investments: investmentCount,
      loans: loanCount,
      policies: policyCount,
      documents: documentCount,
    },
    activeNotificationRules,
    notificationsByStatus: Object.fromEntries(
      NOTIFICATION_STATUSES.map((status, i) => [
        status,
        notificationStatusCounts[i],
      ]),
    ) as Record<NotificationStatus, number>,
  };
}

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: boolean | null;
  currency: string;
  createdAt: Date;
  propertyCount: number;
  investmentCount: number;
  loanCount: number;
}

/** Every user, newest first, with a light per-user portfolio-size count. */
export async function listUsers(): Promise<AdminUserRow[]> {
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { properties: true, investments: true, loans: true },
      },
    },
  });

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role ?? null,
    banned: user.banned ?? false,
    currency: user.currency,
    createdAt: user.createdAt,
    propertyCount: user._count.properties,
    investmentCount: user._count.investments,
    loanCount: user._count.loans,
  }));
}

/** Numbers for Admin › Jobs: what the background jobs are working on. */
export async function getJobsOverview(now = new Date()) {
  const inDays = (days: number) =>
    new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const [
    activeSchedules,
    upcomingBills,
    scheduledJobs,
    dueJobs,
    processingJobs,
    failedLast7d,
    sentLast24h,
  ] = await Promise.all([
    db.billSchedule.count({ where: { active: true, ...NOT_SOFT_DELETED } }),
    db.bill.count({
      where: {
        status: { in: ["DUE", "OVERDUE", "PARTIALLY_PAID"] },
        dueDate: { gte: now, lte: inDays(35) },
        ...NOT_SOFT_DELETED,
      },
    }),
    db.notificationJob.count({ where: { status: "SCHEDULED" } }),
    db.notificationJob.count({
      where: { status: "SCHEDULED", scheduledFor: { lte: now } },
    }),
    db.notificationJob.count({ where: { status: "PROCESSING" } }),
    db.notificationJob.count({
      where: { status: "FAILED", updatedAt: { gte: inDays(-7) } },
    }),
    db.notificationJob.count({
      where: { status: "SENT", sentAt: { gte: inDays(-1) } },
    }),
  ]);
  return {
    activeSchedules,
    upcomingBills,
    scheduledJobs,
    dueJobs,
    processingJobs,
    failedLast7d,
    sentLast24h,
  };
}
