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
  it("creates a SCHEDULED job, giving it a random key when none is given", async () => {
    dbMock.notificationJob.create.mockResolvedValue({ id: "job-1" } as never);

    const result = await enqueueNotificationJob(BASE_ARGS);

    expect(result).toEqual({ job: { id: "job-1" }, created: true });
    const { data } = dbMock.notificationJob.create.mock.calls[0]![0];
    expect(data).toMatchObject({ ...BASE_ARGS, status: "SCHEDULED" });
    // MongoDB's unique index admits only one missing key, so every job
    // must have one.
    expect(data.idempotencyKey).toMatch(/^job:[0-9a-f-]{36}$/);
    expect(dbMock.notificationJob.findUnique).not.toHaveBeenCalled();
  });

  it("gives two keyless jobs different keys", async () => {
    dbMock.notificationJob.create.mockResolvedValue({ id: "job" } as never);

    await enqueueNotificationJob(BASE_ARGS);
    await enqueueNotificationJob(BASE_ARGS);

    const [first, second] = dbMock.notificationJob.create.mock.calls.map(
      ([arg]) => arg.data.idempotencyKey,
    );
    expect(first).not.toBe(second);
  });

  it("returns an existing job for the same key, untouched", async () => {
    dbMock.notificationJob.findUnique.mockResolvedValue({
      id: "job-1",
      status: "SENT",
    } as never);

    const result = await enqueueNotificationJob({
      ...BASE_ARGS,
      idempotencyKey: "rent:lease-1:2026-09-12",
    });

    expect(result).toEqual({
      job: { id: "job-1", status: "SENT" },
      created: false,
    });
    expect(dbMock.notificationJob.findUnique).toHaveBeenCalledWith({
      where: { idempotencyKey: "rent:lease-1:2026-09-12" },
    });
    expect(dbMock.notificationJob.create).not.toHaveBeenCalled();
    expect(dbMock.notificationJob.update).not.toHaveBeenCalled();
  });

  it("creates the job when the key is new", async () => {
    dbMock.notificationJob.findUnique.mockResolvedValue(null);
    dbMock.notificationJob.create.mockResolvedValue({ id: "job-2" } as never);

    const result = await enqueueNotificationJob({
      ...BASE_ARGS,
      idempotencyKey: "k-1",
    });

    expect(result.created).toBe(true);
    expect(dbMock.notificationJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ idempotencyKey: "k-1" }),
    });
  });

  it("treats losing a race on the same key as already queued", async () => {
    dbMock.notificationJob.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "job-winner" } as never);
    dbMock.notificationJob.create.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );

    const result = await enqueueNotificationJob({
      ...BASE_ARGS,
      idempotencyKey: "k-1",
    });

    expect(result).toEqual({ job: { id: "job-winner" }, created: false });
  });

  it("rethrows any other database error", async () => {
    dbMock.notificationJob.findUnique.mockResolvedValue(null);
    dbMock.notificationJob.create.mockRejectedValue(
      new Error("connection lost"),
    );

    await expect(
      enqueueNotificationJob({ ...BASE_ARGS, idempotencyKey: "k-1" }),
    ).rejects.toThrow("connection lost");
  });

  it("passes metadata through untouched", async () => {
    dbMock.notificationJob.create.mockResolvedValue({ id: "job-1" } as never);
    const metadata = { actionUrl: "https://trackmyestate.app/x", guestId: "g" };

    await enqueueNotificationJob({ ...BASE_ARGS, metadata });

    expect(dbMock.notificationJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ metadata }),
    });
  });
});
