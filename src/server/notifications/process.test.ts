import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { dispatchNotificationJob } from "./engine";
import { processDueNotificationJobs } from "./process";
import type { NotificationJobWithMetadata } from "./types";

jest.mock("~/server/db");
jest.mock("./engine", () => ({
  dispatchNotificationJob: jest.fn(),
}));

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;
const dispatchMock = dispatchNotificationJob as jest.Mock;

function buildJob(id: string): NotificationJobWithMetadata {
  return { id, channel: "EMAIL" } as NotificationJobWithMetadata;
}

beforeEach(() => {
  mockReset(dbMock);
  dispatchMock.mockReset();
});

describe("processDueNotificationJobs", () => {
  it("queries only SCHEDULED jobs due by now, oldest first", async () => {
    dbMock.notificationJob.findMany.mockResolvedValue([]);
    const now = new Date("2026-09-15T00:00:00Z");

    await processDueNotificationJobs(now);

    expect(dbMock.notificationJob.findMany).toHaveBeenCalledWith({
      where: { status: "SCHEDULED", scheduledFor: { lte: now } },
      orderBy: { scheduledFor: "asc" },
    });
  });

  it("dispatches every due job and tallies outcomes", async () => {
    dbMock.notificationJob.findMany.mockResolvedValue([
      buildJob("job-1"),
      buildJob("job-2"),
      buildJob("job-3"),
    ] as never);
    dispatchMock
      .mockResolvedValueOnce("SENT")
      .mockResolvedValueOnce("SENT")
      .mockResolvedValueOnce("SKIPPED");

    const summary = await processDueNotificationJobs();

    expect(dispatchMock).toHaveBeenCalledTimes(3);
    expect(summary).toEqual({
      total: 3,
      outcomes: {
        SENT: 2,
        SKIPPED: 1,
        RETRY_SCHEDULED: 0,
        FAILED: 0,
        ALREADY_CLAIMED: 0,
      },
    });
  });

  it("returns an all-zero summary when nothing is due", async () => {
    dbMock.notificationJob.findMany.mockResolvedValue([]);

    const summary = await processDueNotificationJobs();

    expect(summary.total).toBe(0);
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});
