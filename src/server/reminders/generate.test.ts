import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { enqueueNotificationJob } from "~/server/notifications/enqueue";
import { BATCH_SIZE, generateReminders } from "./generate";

jest.mock("~/server/db");
jest.mock("~/env", () => ({
  env: {
    NEXT_PUBLIC_SITE_URL: "https://trackmyestate.app",
    BETTER_AUTH_SECRET: "test-secret",
  },
}));
jest.mock("~/server/notifications/enqueue", () => ({
  enqueueNotificationJob: jest.fn(),
}));

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;
const enqueueMock = enqueueNotificationJob as jest.Mock;

// 10:00 in India on 5 Oct 2026.
const now = new Date("2026-10-05T04:30:00Z");

function bill(overrides: Record<string, unknown> = {}) {
  return {
    id: "bill-1",
    ownerId: "user-1",
    category: "UTILITY_BILL",
    direction: "OUTFLOW",
    billScheduleId: "sched-1",
    propertyId: "prop-1",
    leaseId: null,
    loanId: null,
    policyId: null,
    investmentId: null,
    // Due 8 Oct in India: 3 days away — matches the utility default of -3.
    dueDate: new Date("2026-10-08"),
    amount: 4120,
    status: "DUE",
    description: "BESCOM electricity",
    ...overrides,
  };
}

beforeEach(() => {
  mockReset(dbMock);
  enqueueMock.mockReset().mockResolvedValue({ created: true });
  dbMock.user.findMany.mockResolvedValue([
    {
      id: "user-1",
      name: "Ananya Rao",
      email: "owner@example.com",
      timezone: "Asia/Kolkata",
      reminderHour: null,
    },
  ] as never);
  dbMock.notificationRule.findMany.mockResolvedValue([]);
  dbMock.guest.findMany.mockResolvedValue([]);
  dbMock.billSchedule.findMany.mockResolvedValue([
    {
      id: "sched-1",
      recipients: [
        { name: "Spouse", email: "spouse@example.com", notifyOnDue: true },
        { name: "Accountant", email: "ca@example.com", notifyOnDue: false },
      ],
    },
  ] as never);
});

describe("generateReminders", () => {
  it("queues a reminder for a bill whose offset matches today", async () => {
    dbMock.bill.findMany.mockResolvedValueOnce([bill()] as never);

    const summary = await generateReminders(now);

    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: "user-1",
        category: "UTILITY_BILL",
        channel: "EMAIL",
        recipient: "owner@example.com",
        title: "BESCOM electricity: ₹4,120 due in 3 days",
        billId: "bill-1",
        // 09:00 in India on 5 Oct.
        scheduledFor: new Date("2026-10-05T03:30:00Z"),
        idempotencyKey: "reminder:bill-1:DUE_DATE:-3:EMAIL:owner@example.com",
        metadata: {
          actionUrl:
            "https://trackmyestate.app/properties/prop-1/utilities/bills/bill-1",
        },
      }),
    );
    expect(summary).toEqual({ scanned: 1, queued: 2, hasMore: false });
  });

  it("also emails the utility's recipients who want due reminders", async () => {
    dbMock.bill.findMany.mockResolvedValueOnce([bill()] as never);

    await generateReminders(now);

    const recipients = enqueueMock.mock.calls.map(
      ([job]) => (job as { recipient: string }).recipient,
    );
    expect(recipients).toEqual(["owner@example.com", "spouse@example.com"]);
  });

  it("queues nothing on a day no reminder falls on", async () => {
    // Due in 5 days — not one of the utility defaults (-3, 0, +3).
    dbMock.bill.findMany.mockResolvedValueOnce([
      bill({ dueDate: new Date("2026-10-10") }),
    ] as never);

    const summary = await generateReminders(now);

    expect(enqueueMock).not.toHaveBeenCalled();
    expect(summary.queued).toBe(0);
  });

  it("follows the owner's customised schedule", async () => {
    dbMock.notificationRule.findMany.mockResolvedValue([
      {
        ownerId: "user-1",
        category: "UTILITY_BILL",
        offsetDays: -7,
        channels: ["EMAIL"],
        active: true,
      },
    ] as never);
    dbMock.bill.findMany.mockResolvedValueOnce([bill()] as never);

    await generateReminders(now);

    // -3 is a default, but the owner replaced the defaults with only -7.
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("counts days in the owner's time zone", async () => {
    // 20:00 UTC on 5 Oct: already 6 Oct in India, still 5 Oct in New York.
    const evening = new Date("2026-10-05T20:00:00Z");
    // Due 9 Oct in both zones: 3 days away in India, 4 in New York.
    const dueDate = new Date("2026-10-09");
    dbMock.bill.findMany.mockResolvedValue([bill({ dueDate })] as never);

    await generateReminders(evening);
    expect(enqueueMock).toHaveBeenCalled();

    enqueueMock.mockReset().mockResolvedValue({ created: true });
    dbMock.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        email: "owner@example.com",
        timezone: "America/New_York",
      },
    ] as never);
    await generateReminders(evening);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("words incoming money as expected, not due", async () => {
    dbMock.bill.findMany.mockResolvedValueOnce([
      bill({
        category: "RENT",
        billScheduleId: null,
        description: "Rent · Whitefield",
        amount: 32000,
        // Due today in India.
        dueDate: new Date("2026-10-05"),
      }),
    ] as never);

    await generateReminders(now);

    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Rent · Whitefield: ₹32,000 expected today",
        metadata: { actionUrl: "https://trackmyestate.app/timeline" },
      }),
    );
  });

  it("only looks at unpaid bills near today, page by page", async () => {
    dbMock.bill.findMany
      .mockResolvedValueOnce(
        Array.from({ length: BATCH_SIZE }, (_, i) =>
          bill({ id: `bill-${i}` }),
        ) as never,
      )
      .mockResolvedValueOnce([] as never);

    await generateReminders(now);

    const [first, second] = dbMock.bill.findMany.mock.calls.map(([a]) => a);
    expect(first?.where?.status).toEqual({
      in: ["DUE", "OVERDUE", "PARTIALLY_PAID"],
    });
    expect(first?.take).toBe(BATCH_SIZE);
    expect(second?.cursor).toEqual({ id: `bill-${BATCH_SIZE - 1}` });
    expect(second?.skip).toBe(1);
  });
});

describe("generateReminders — owner preferences and guests", () => {
  function guest(overrides: Record<string, unknown> = {}) {
    return {
      id: "guest-1",
      ownerId: "user-1",
      name: "Radha Rao",
      email: "radha@example.com",
      phone: null,
      channels: ["EMAIL"],
      categories: ["UTILITY_BILL"],
      propertyIds: [],
      dueDayOnly: false,
      ...overrides,
    };
  }

  function guestJobs() {
    return enqueueMock.mock.calls
      .map(([job]) => job as Record<string, unknown>)
      .filter((job) => String(job.idempotencyKey).includes(":guest:"));
  }

  it("sends at the owner's chosen hour", async () => {
    dbMock.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        name: "Ananya Rao",
        email: "owner@example.com",
        timezone: "Asia/Kolkata",
        reminderHour: 18,
      },
    ] as never);
    dbMock.bill.findMany.mockResolvedValueOnce([bill()] as never);

    await generateReminders(now);

    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        // 18:00 in India on 5 Oct.
        scheduledFor: new Date("2026-10-05T12:30:00Z"),
      }),
    );
  });

  it("emails a matching guest in the owner's name, with a stop link", async () => {
    dbMock.guest.findMany.mockResolvedValue([guest()] as never);
    dbMock.bill.findMany.mockResolvedValueOnce([bill()] as never);

    await generateReminders(now);

    const [job] = guestJobs();
    expect(job).toMatchObject({
      recipient: "radha@example.com",
      title: "BESCOM electricity: ₹4,120 due in 3 days",
      idempotencyKey: "reminder:bill-1:DUE_DATE:-3:EMAIL:guest:guest-1",
      metadata: { actionLabel: "Stop these reminders" },
    });
    expect(String(job?.body)).toContain("From Ananya Rao");
    expect(
      String((job?.metadata as { actionUrl: string }).actionUrl),
    ).toContain("/reminders/stop?guest=guest-1");
  });

  it("only asks for guests who aren't paused or opted out", async () => {
    dbMock.bill.findMany.mockResolvedValueOnce([bill()] as never);

    await generateReminders(now);

    const where = dbMock.guest.findMany.mock.calls[0]?.[0]?.where;
    expect(JSON.stringify(where)).toContain("pausedAt");
    expect(JSON.stringify(where)).toContain("optedOutAt");
  });

  it("skips guests for other kinds or other properties", async () => {
    dbMock.guest.findMany.mockResolvedValue([
      guest({ id: "g-kind", categories: ["RENT"] }),
      guest({ id: "g-prop", propertyIds: ["other-prop"] }),
      guest({ id: "g-ok", propertyIds: ["prop-1"] }),
    ] as never);
    dbMock.bill.findMany.mockResolvedValueOnce([bill()] as never);

    await generateReminders(now);

    expect(guestJobs().map((job) => job.idempotencyKey)).toEqual([
      "reminder:bill-1:DUE_DATE:-3:EMAIL:guest:g-ok",
    ]);
  });

  it("reminds a due-day-only guest only on the due day", async () => {
    dbMock.guest.findMany.mockResolvedValue([
      guest({ dueDayOnly: true }),
    ] as never);

    // 3 days before: the owner is reminded, the guest isn't.
    dbMock.bill.findMany.mockResolvedValueOnce([bill()] as never);
    await generateReminders(now);
    expect(guestJobs()).toHaveLength(0);

    // On the due day: the guest is reminded.
    enqueueMock.mockReset().mockResolvedValue({ created: true });
    dbMock.bill.findMany.mockResolvedValueOnce([
      bill({ dueDate: new Date("2026-10-05") }),
    ] as never);
    await generateReminders(now);
    expect(guestJobs()).toHaveLength(1);
  });

  it("doesn't email a guest who has no email address", async () => {
    dbMock.guest.findMany.mockResolvedValue([
      guest({ email: null, channels: ["WHATSAPP"], phone: "+919876543210" }),
    ] as never);
    dbMock.bill.findMany.mockResolvedValueOnce([bill()] as never);

    await generateReminders(now);

    expect(guestJobs()).toHaveLength(0);
  });
});
