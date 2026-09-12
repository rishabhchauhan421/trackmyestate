/**
 * Write side of the engine: schedules a `NotificationJob` for later
 * delivery. Callers are things like a `NotificationRule` evaluator or a
 * one-off "payment received" hook — none of which exist yet — so this is
 * the seam they'll call into once built.
 */
import "server-only";

import type {
  EventCategory,
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

export async function enqueueNotificationJob(
  args: EnqueueNotificationJobArgs,
) {
  const { idempotencyKey, metadata, ...rest } = args;

  const data = {
    ...rest,
    status: "SCHEDULED" as const,
    metadata: metadata as Prisma.InputJsonValue | undefined,
    idempotencyKey,
  };

  if (!idempotencyKey) {
    return db.notificationJob.create({ data });
  }

  return db.notificationJob.upsert({
    where: { idempotencyKey },
    create: data,
    // A job that already exists for this key keeps whatever the engine has
    // already done with it — re-enqueuing must never resurrect or resend
    // a job that's SENT/FAILED/SKIPPED.
    update: {},
  });
}
