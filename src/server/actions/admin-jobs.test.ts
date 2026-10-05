import { getSession, isAdmin } from "~/server/better-auth/server";
import { generateBills } from "~/server/bills/generate";
import { processDueNotificationJobs } from "~/server/notifications/process";
import { generateReminders } from "~/server/reminders/generate";
import {
  runBillGeneration,
  runNotificationDrain,
  runReminderGeneration,
} from "./admin-jobs";

jest.mock("~/server/better-auth/server", () => ({
  getSession: jest.fn(),
  isAdmin: jest.fn(),
}));
jest.mock("~/server/bills/generate", () => ({ generateBills: jest.fn() }));
jest.mock("~/server/reminders/generate", () => ({
  generateReminders: jest.fn(),
}));
jest.mock("~/server/notifications/process", () => ({
  processDueNotificationJobs: jest.fn(),
}));
jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

const getSessionMock = getSession as jest.Mock;
const isAdminMock = isAdmin as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  getSessionMock.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
  isAdminMock.mockReturnValue(true);
});

describe("admin jobs", () => {
  it("runs bill generation and reports what it did", async () => {
    (generateBills as jest.Mock).mockResolvedValue({
      schedulesScanned: 40,
      billsCreated: 12,
      skippedNoAmount: 1,
      hasMore: false,
    });

    await expect(runBillGeneration()).rejects.toThrow(
      "REDIRECT:/admin/jobs?ran=bills&created=12&scanned=40&skipped=1&more=false",
    );
  });

  it("runs reminder queueing", async () => {
    (generateReminders as jest.Mock).mockResolvedValue({
      scanned: 9,
      queued: 4,
      hasMore: false,
    });

    await expect(runReminderGeneration()).rejects.toThrow(
      "REDIRECT:/admin/jobs?ran=reminders&queued=4&scanned=9&more=false",
    );
  });

  it("runs the send queue, counting errors as failures", async () => {
    (processDueNotificationJobs as jest.Mock).mockResolvedValue({
      total: 6,
      outcomes: {
        SENT: 3,
        CANCELLED: 1,
        FAILED: 1,
        ERRORED: 1,
        RETRY_SCHEDULED: 0,
        SKIPPED: 0,
        ALREADY_CLAIMED: 0,
      },
      reclaimed: 0,
      purged: 0,
      hasMore: false,
    });

    await expect(runNotificationDrain()).rejects.toThrow(
      "ran=notifications&total=6&sent=3&cancelled=1&failed=2&retrying=0",
    );
  });

  it("refuses a signed-in non-admin, without running anything", async () => {
    isAdminMock.mockReturnValue(false);

    await expect(runBillGeneration()).rejects.toThrow(
      "Only admins can run jobs",
    );
    await expect(runReminderGeneration()).rejects.toThrow(
      "Only admins can run jobs",
    );
    await expect(runNotificationDrain()).rejects.toThrow(
      "Only admins can run jobs",
    );
    expect(generateBills).not.toHaveBeenCalled();
    expect(generateReminders).not.toHaveBeenCalled();
    expect(processDueNotificationJobs).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to sign in", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(runBillGeneration()).rejects.toThrow("REDIRECT:/login");
    expect(generateBills).not.toHaveBeenCalled();
  });
});
