import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { dispatchNotificationJob, MAX_SEND_ATTEMPTS } from "./engine";
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

    const outcome = await dispatchNotificationJob(
      buildJob({ retryCount: 0 }),
    );

    expect(outcome).toBe("RETRY_SCHEDULED");
    expect(dbMock.notificationJob.update).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: {
        status: "SCHEDULED",
        retryCount: 1,
        failedReason: "Temporary provider outage",
      },
    });
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

    const outcome = await dispatchNotificationJob(
      buildJob({ retryCount: 0 }),
    );

    expect(outcome).toBe("FAILED");
  });

  it("treats an unexpected thrown error as a retryable failure", async () => {
    dbMock.notificationJob.updateMany.mockResolvedValue({ count: 1 });
    sendEmailMock.mockRejectedValue(new Error("network blip"));

    const outcome = await dispatchNotificationJob(
      buildJob({ retryCount: 0 }),
    );

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
