import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { enqueueNotificationJob } from "./enqueue";

jest.mock("~/server/db");

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;

const BASE_ARGS = {
  ownerId: "user-1",
  category: "RENT" as const,
  channel: "EMAIL" as const,
  recipient: "owner@example.com",
  title: "Rent due in 3 days",
  body: "Rent is due",
  scheduledFor: new Date("2026-09-12T00:00:00Z"),
};

beforeEach(() => {
  mockReset(dbMock);
});

describe("enqueueNotificationJob", () => {
  it("creates a plain job when no idempotencyKey is given", async () => {
    dbMock.notificationJob.create.mockResolvedValue({ id: "job-1" } as never);

    await enqueueNotificationJob(BASE_ARGS);

    expect(dbMock.notificationJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: "user-1",
        status: "SCHEDULED",
        idempotencyKey: undefined,
      }),
    });
    expect(dbMock.notificationJob.upsert).not.toHaveBeenCalled();
  });

  it("upserts on idempotencyKey, leaving an existing job untouched", async () => {
    dbMock.notificationJob.upsert.mockResolvedValue({
      id: "job-1",
    } as never);

    await enqueueNotificationJob({
      ...BASE_ARGS,
      idempotencyKey: "rule-1:EMAIL:2026-09-12",
    });

    expect(dbMock.notificationJob.upsert).toHaveBeenCalledWith({
      where: { idempotencyKey: "rule-1:EMAIL:2026-09-12" },
      create: expect.objectContaining({ status: "SCHEDULED" }),
      update: {},
    });
    expect(dbMock.notificationJob.create).not.toHaveBeenCalled();
  });

  it("passes metadata through untouched", async () => {
    dbMock.notificationJob.create.mockResolvedValue({ id: "job-1" } as never);

    await enqueueNotificationJob({
      ...BASE_ARGS,
      metadata: { actionUrl: "https://trackmyestate.app/properties/prop-1" },
    });

    expect(dbMock.notificationJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: { actionUrl: "https://trackmyestate.app/properties/prop-1" },
      }),
    });
  });
});
