import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import {
  dispatchNotificationJob,
  MAX_SEND_ATTEMPTS,
  RETRY_BASE_DELAY_MS,
  retryDelayMs,
} from "./engine";
import { CHANNEL_SENDERS } from "./registry";
import { NotImplementedChannelError } from "./types";
import type { NotificationJobWithMetadata } from "./types";

jest.mock("~/server/db");
jest.mock("./registry", () => ({
  CHANNEL_SENDERS: { EMAIL: jest.fn(), WHATSAPP: jest.fn() },
}));

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;
const sendEmailMock = CHANNEL_SENDERS.EMAIL as jest.Mock;
const sendWhatsAppMock = CHANNEL_SENDERS.WHATSAPP as jest.Mock;

function buildJob(
  overrides: Partial<NotificationJobWithMetadata> = {},
): NotificationJobWithMetadata {
  return {
    id: "job-1",
    channel: "EMAIL",
    recipient: "owner@example.com",
    title: "Rent due",
    body: "Rent is due",
    retryCount: 0,
    metadata: null,
    ...overrides,
  } as NotificationJobWithMetadata;
}

beforeEach(() => {
  mockReset(dbMock);
  sendEmailMock.mockReset();
  sendWhatsAppMock.mockReset();
});

describe("dispatchNotificationJob", () => {
  it("does nothing and reports ALREADY_CLAIMED when another run already claimed the job", async () => {
    dbMock.notificationJob.updateMany.mockResolvedValue({ count: 0 });

    const outcome = await dispatchNotificationJob(buildJob());

    expect(outcome).toBe("ALREADY_CLAIMED");
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(dbMock.notificationJob.update).not.toHaveBeenCalled();
  });

  it("claims the job, sends it, and marks it SENT on success", async () => {
    dbMock.notificationJob.updateMany.mockResolvedValue({ count: 1 });
    sendEmailMock.mockResolvedValue({ ok: true, providerMessageId: "msg-1" });

    const outcome = await dispatchNotificationJob(buildJob());

    expect(outcome).toBe("SENT");
    expect(dbMock.notificationJob.updateMany).toHaveBeenCalledWith({
      where: { id: "job-1", status: "SCHEDULED" },
      data: { status: "PROCESSING" },
    });
    expect(dbMock.notificationJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({ status: "SENT", failedReason: null }),
    });
  });

  it("marks the job SKIPPED when the channel isn't implemented yet", async () => {
    dbMock.notificationJob.updateMany.mockResolvedValue({ count: 1 });
    sendWhatsAppMock.mockImplementation(() => {
      throw new NotImplementedChannelError("WHATSAPP");
    });

    const outcome = await dispatchNotificationJob(
      buildJob({ channel: "WHATSAPP" }),
    );

    expect(outcome).toBe("SKIPPED");
    expect(dbMock.notificationJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({ status: "SKIPPED" }),
    });
  });

  it("reschedules a retryable failure below the attempt cap", async () => {
    dbMock.notificationJob.updateMany.mockResolvedValue({ count: 1 });
    sendEmailMock.mockResolvedValue({
      ok: false,
      retryable: true,
      reason: "Temporary provider outage",
    });

    const before = Date.now();
    const outcome = await dispatchNotificationJob(buildJob({ retryCount: 0 }));

    expect(outcome).toBe("RETRY_SCHEDULED");
    expect(dbMock.notificationJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: {
        status: "SCHEDULED",
        retryCount: 1,
        failedReason: "Temporary provider outage",
        scheduledFor: expect.any(Date) as Date,
      },
    });
    // Rescheduled one base delay out, not left due immediately.
    const { data } = dbMock.notificationJob.update.mock.calls[0]![0];
    const retryAt = (data.scheduledFor as Date).getTime();
    expect(retryAt).toBeGreaterThanOrEqual(before + RETRY_BASE_DELAY_MS);
    expect(retryAt).toBeLessThan(before + RETRY_BASE_DELAY_MS + 5_000);
  });

  it("gives up once a retryable failure hits the attempt cap", async () => {
    dbMock.notificationJob.updateMany.mockResolvedValue({ count: 1 });
    sendEmailMock.mockResolvedValue({
      ok: false,
      retryable: true,
      reason: "Temporary provider outage",
    });

    const outcome = await dispatchNotificationJob(
      buildJob({ retryCount: MAX_SEND_ATTEMPTS - 1 }),
    );

    expect(outcome).toBe("FAILED");
    expect(dbMock.notificationJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({ status: "FAILED" }),
    });
  });

  it("fails immediately on a non-retryable failure regardless of attempt count", async () => {
    dbMock.notificationJob.updateMany.mockResolvedValue({ count: 1 });
    sendEmailMock.mockResolvedValue({
      ok: false,
      retryable: false,
      reason: "Invalid recipient address",
    });

    const outcome = await dispatchNotificationJob(buildJob({ retryCount: 0 }));

    expect(outcome).toBe("FAILED");
  });

  it("treats an unexpected thrown error as a retryable failure", async () => {
    dbMock.notificationJob.updateMany.mockResolvedValue({ count: 1 });
    sendEmailMock.mockRejectedValue(new Error("network blip"));

    const outcome = await dispatchNotificationJob(buildJob({ retryCount: 0 }));

    expect(outcome).toBe("RETRY_SCHEDULED");
    expect(dbMock.notificationJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: "SCHEDULED",
        failedReason: "network blip",
      }),
    });
  });
});

describe("retryDelayMs", () => {
  it("doubles the delay with each attempt: 5, 10, 20 minutes", () => {
    expect([1, 2, 3].map(retryDelayMs)).toEqual([
      RETRY_BASE_DELAY_MS,
      RETRY_BASE_DELAY_MS * 2,
      RETRY_BASE_DELAY_MS * 4,
    ]);
    expect(RETRY_BASE_DELAY_MS).toBe(5 * 60 * 1000);
  });
});

describe("stop when paid", () => {
  it("cancels a reminder whose bill was paid after it was queued", async () => {
    dbMock.notificationJob.updateMany.mockResolvedValue({ count: 1 });
    dbMock.bill.findUnique.mockResolvedValue({ status: "PAID" } as never);

    const outcome = await dispatchNotificationJob(
      buildJob({ billId: "bill-1" }),
    );

    expect(outcome).toBe("CANCELLED");
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(dbMock.notificationJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "CANCELLED", failedReason: "Bill is paid" },
    });
  });

  it("sends a reminder whose bill is still unpaid", async () => {
    dbMock.notificationJob.updateMany.mockResolvedValue({ count: 1 });
    dbMock.bill.findUnique.mockResolvedValue({ status: "OVERDUE" } as never);
    sendEmailMock.mockResolvedValue({ ok: true });

    const outcome = await dispatchNotificationJob(
      buildJob({ billId: "bill-1" }),
    );

    expect(outcome).toBe("SENT");
    expect(sendEmailMock).toHaveBeenCalled();
  });

  it("doesn't look up a bill for a job that isn't about one", async () => {
    dbMock.notificationJob.updateMany.mockResolvedValue({ count: 1 });
    sendEmailMock.mockResolvedValue({ ok: true });

    await dispatchNotificationJob(buildJob({ billId: null }));

    expect(dbMock.bill.findUnique).not.toHaveBeenCalled();
  });
});

describe("guest reminders", () => {
  beforeEach(() => {
    dbMock.notificationJob.updateMany.mockResolvedValue({ count: 1 });
    sendEmailMock.mockResolvedValue({ ok: true });
  });

  it.each([
    [
      { optedOutAt: new Date(), pausedAt: null, deletedAt: null },
      "Guest stopped reminders",
    ],
    [
      { optedOutAt: null, pausedAt: null, deletedAt: new Date() },
      "Guest was removed",
    ],
    [
      { optedOutAt: null, pausedAt: new Date(), deletedAt: null },
      "Guest is paused",
    ],
    [null, "Guest no longer exists"],
  ])("cancels when the guest is %p", async (guest, reason) => {
    dbMock.guest.findUnique.mockResolvedValue(guest as never);

    const outcome = await dispatchNotificationJob(
      buildJob({ metadata: { guestId: "guest-1" } }),
    );

    expect(outcome).toBe("CANCELLED");
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(dbMock.notificationJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { status: "CANCELLED", failedReason: reason },
    });
  });

  it("sends to an active guest", async () => {
    dbMock.guest.findUnique.mockResolvedValue({
      optedOutAt: null,
      pausedAt: null,
      deletedAt: null,
    } as never);

    const outcome = await dispatchNotificationJob(
      buildJob({ metadata: { guestId: "guest-1" } }),
    );

    expect(outcome).toBe("SENT");
  });

  it("doesn't look up a guest for an owner's reminder", async () => {
    await dispatchNotificationJob(buildJob({ metadata: { actionUrl: "x" } }));
    expect(dbMock.guest.findUnique).not.toHaveBeenCalled();
  });
});
