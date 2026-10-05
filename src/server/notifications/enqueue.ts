/**
 * Write side of the engine: schedules a `NotificationJob` for later
 * delivery. The reminder generator (`~/server/reminders/generate`) is the
 * main caller.
 */
import "server-only";

import { randomUUID } from "node:crypto";

import type {
  EventCategory,
  NotificationJob,
  Prisma,
  ReminderChannel,
} from "../../../generated/prisma";
import { db } from "~/server/db";
import type { NotificationJobMetadata } from "./types";

export interface EnqueueNotificationJobArgs {
  ownerId: string;
  category: EventCategory;
  channel: ReminderChannel;
  recipient: string;
  title: string;
  body: string;
  scheduledFor: Date;
  notificationRuleId?: string;
  billScheduleId?: string;
  billId?: string;
  propertyId?: string;
  leaseId?: string;
  loanId?: string;
  policyId?: string;
  investmentId?: string;
  batchGroup?: string;
  metadata?: NotificationJobMetadata;
  /**
   * Dedup key — e.g. `${ruleId}:${channel}:${dueDate.toISOString()}`. When
   * set and a job with the same key already exists, that job is returned
   * unchanged instead of creating a duplicate (so a rule evaluator that
   * re-runs, or overlapping cron ticks, can call this idempotently).
   */
  idempotencyKey?: string;
}

export interface EnqueueResult {
  job: NotificationJob;
  /** False when a job with the same idempotency key already existed. */
  created: boolean;
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export async function enqueueNotificationJob(
  args: EnqueueNotificationJobArgs,
): Promise<EnqueueResult> {
  const { idempotencyKey, metadata, ...rest } = args;

  const data = {
    ...rest,
    status: "SCHEDULED" as const,
    metadata: metadata as Prisma.InputJsonValue | undefined,
    // Every job gets a key: MongoDB's unique index on `idempotencyKey`
    // treats a missing key as null and admits only one such document.
    idempotencyKey: idempotencyKey ?? `job:${randomUUID()}`,
  };

  // A job that already exists for this key keeps whatever the engine has
  // done with it — re-enqueuing must never resurrect or resend a job that's
  // SENT/FAILED/SKIPPED/CANCELLED.
  if (idempotencyKey) {
    const existing = await db.notificationJob.findUnique({
      where: { idempotencyKey },
    });
    if (existing) return { job: existing, created: false };
  }

  try {
    return {
      job: await db.notificationJob.create({ data }),
      created: true,
    };
  } catch (error) {
    // Lost a race with a concurrent run enqueueing the same key.
    if (idempotencyKey && isUniqueConstraintError(error)) {
      const existing = await db.notificationJob.findUnique({
        where: { idempotencyKey },
      });
      if (existing) return { job: existing, created: false };
    }
    throw error;
  }
}
