import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { MAX_SEND_ATTEMPTS, dispatchNotificationJob } from "./engine";
import {
  BATCH_SIZE,
  RETENTION_DAYS,
  STALE_CLAIM_MS,
  processDueNotificationJobs,
} from "./process";
import type { NotificationJobWithMetadata } from "./types";

jest.mock("~/server/db");
jest.mock("./engine", () => ({
  MAX_SEND_ATTEMPTS: 3,
  dispatchNotificationJob: jest.fn(),
}));

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;
const dispatchMock = dispatchNotificationJob as jest.Mock;

function buildJob(id: string): NotificationJobWithMetadata {
  return { id, channel: "EMAIL" } as NotificationJobWithMetadata;
}

function buildJobs(count: number, prefix = "job") {
  return Array.from({ length: count }, (_, i) => buildJob(`${prefix}-${i}`));
}

const now = new Date("2026-10-05T09:00:00Z");

beforeEach(() => {
  mockReset(dbMock);
  dispatchMock.mockReset().mockResolvedValue("SENT");
  dbMock.notificationJob.updateMany.mockResolvedValue({ count: 0 });
  dbMock.notificationJob.deleteMany.mockResolvedValue({ count: 0 });
});

describe("processDueNotificationJobs", () => {
  it("queries SCHEDULED jobs due by now, oldest first, one batch at a time", async () => {
    dbMock.notificationJob.findMany.mockResolvedValue([]);

    await processDueNotificationJobs(now);

    expect(dbMock.notificationJob.findMany).toHaveBeenCalledWith({
      where: { status: "SCHEDULED", scheduledFor: { lte: now } },
      orderBy: { scheduledFor: "asc" },
      take: BATCH_SIZE,
    });
  });

  it("dispatches every due job and tallies outcomes", async () => {
    dbMock.notificationJob.findMany.mockResolvedValue(buildJobs(3) as never);
    dispatchMock
      .mockResolvedValueOnce("SENT")
      .mockResolvedValueOnce("SENT")
      .mockResolvedValueOnce("SKIPPED");

    const summary = await processDueNotificationJobs(now);

    expect(dispatchMock).toHaveBeenCalledTimes(3);
    expect(summary).toEqual({
      total: 3,
      outcomes: {
        SENT: 2,
        SKIPPED: 1,
        RETRY_SCHEDULED: 0,
        FAILED: 0,
        ALREADY_CLAIMED: 0,
        CANCELLED: 0,
      },
      reclaimed: 0,
      purged: 0,
      hasMore: false,
    });
  });

  it("keeps fetching batches until one comes back short", async () => {
    dbMock.notificationJob.findMany
      .mockResolvedValueOnce(buildJobs(BATCH_SIZE, "a") as never)
      .mockResolvedValueOnce(buildJobs(BATCH_SIZE, "b") as never)
      .mockResolvedValueOnce(buildJobs(5, "c") as never);

    const summary = await processDueNotificationJobs(now);

    expect(dbMock.notificationJob.findMany).toHaveBeenCalledTimes(3);
    expect(summary.total).toBe(BATCH_SIZE * 2 + 5);
    expect(summary.hasMore).toBe(false);
  });

  it("stops starting new batches once the time budget is spent", async () => {
    dbMock.notificationJob.findMany.mockResolvedValue(
      buildJobs(BATCH_SIZE) as never,
    );
    let fakeNow = 0;
    const clock = () => fakeNow;
    dispatchMock.mockImplementation(async () => {
      fakeNow += 100; // each send takes 100ms
      return "SENT";
    });

    const summary = await processDueNotificationJobs(now, {
      timeBudgetMs: 15_000,
      clock,
    });

    // 100 sends × 100ms = 10s per batch: the second batch ends past 15s.
    expect(dbMock.notificationJob.findMany).toHaveBeenCalledTimes(2);
    expect(summary.total).toBe(BATCH_SIZE * 2);
    expect(summary.hasMore).toBe(true);
  });

  it("returns an all-zero summary when nothing is due", async () => {
    dbMock.notificationJob.findMany.mockResolvedValue([]);

    const summary = await processDueNotificationJobs(now);

    expect(summary.total).toBe(0);
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});

describe("reclaiming jobs stuck in PROCESSING", () => {
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS);

  beforeEach(() => {
    dbMock.notificationJob.findMany.mockResolvedValue([]);
  });

  it("fails stuck jobs that are out of attempts, then requeues the rest", async () => {
    dbMock.notificationJob.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 2 });

    const summary = await processDueNotificationJobs(now);

    expect(dbMock.notificationJob.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        status: "PROCESSING",
        updatedAt: { lt: staleBefore },
        retryCount: { gte: MAX_SEND_ATTEMPTS - 1 },
      },
      data: {
        status: "FAILED",
        retryCount: { increment: 1 },
        failedReason: "Interrupted while sending",
      },
    });
    expect(dbMock.notificationJob.updateMany).toHaveBeenNthCalledWith(2, {
      where: { status: "PROCESSING", updatedAt: { lt: staleBefore } },
      data: {
        status: "SCHEDULED",
        retryCount: { increment: 1 },
        failedReason: "Interrupted while sending",
      },
    });
    expect(summary.reclaimed).toBe(3);
  });

  it("reclaims before dispatching, so requeued jobs go out in the same run", async () => {
    const order: string[] = [];
    dbMock.notificationJob.updateMany.mockImplementation((async () => {
      order.push("reclaim");
      return { count: 0 };
    }) as never);
    dbMock.notificationJob.findMany.mockImplementation((async () => {
      order.push("fetch");
      return [];
    }) as never);

    await processDueNotificationJobs(now);

    expect(order).toEqual(["reclaim", "reclaim", "fetch"]);
  });
});

describe("purging old finished jobs", () => {
  it(`deletes finished jobs scheduled more than ${RETENTION_DAYS} days ago`, async () => {
    dbMock.notificationJob.findMany.mockResolvedValue([]);
    dbMock.notificationJob.deleteMany.mockResolvedValue({ count: 7 });

    const summary = await processDueNotificationJobs(now);

    expect(dbMock.notificationJob.deleteMany).toHaveBeenCalledWith({
      where: {
        status: { in: ["SENT", "FAILED", "SKIPPED", "CANCELLED"] },
        scheduledFor: {
          lt: new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000),
        },
      },
    });
    expect(summary.purged).toBe(7);
  });
});
