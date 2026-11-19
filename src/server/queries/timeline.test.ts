import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { getTimelineEvents } from "~/server/queries/timeline";

jest.mock("~/server/db");

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;

const OWNER_ID = "owner-1";

beforeEach(() => {
  mockReset(dbMock);
  dbMock.billSchedule.findMany.mockResolvedValue([]);
});

describe("getTimelineEvents", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-06-15T06:30:00Z")); // 15 Jun, midday in India
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("bounds a 'month' range to the current calendar month", async () => {
    dbMock.bill.findMany.mockResolvedValue([]);

    await getTimelineEvents(OWNER_ID, "month", "all");

    const call = dbMock.bill.findMany.mock.calls[0]?.[0];
    expect(call?.where?.dueDate).toEqual({
      gte: new Date("2026-06-01"),
      lt: new Date("2026-07-01"),
    });
  });

  it("bounds a 'quarter' range to the current calendar quarter", async () => {
    dbMock.bill.findMany.mockResolvedValue([]);

    await getTimelineEvents(OWNER_ID, "quarter", "all");

    const call = dbMock.bill.findMany.mock.calls[0]?.[0];
    // June (month index 5) falls in Q2: Apr(3)-Jun(5)
    expect(call?.where?.dueDate).toEqual({
      gte: new Date("2026-04-01"),
      lt: new Date("2026-07-01"),
    });
  });

  it("bounds a 'year' range to the current calendar year", async () => {
    dbMock.bill.findMany.mockResolvedValue([]);

    await getTimelineEvents(OWNER_ID, "year", "all");

    const call = dbMock.bill.findMany.mock.calls[0]?.[0];
    expect(call?.where?.dueDate).toEqual({
      gte: new Date("2026-01-01"),
      lt: new Date("2027-01-01"),
    });
  });

  it("rolls a Q4 quarter over into January of the next year", async () => {
    jest.setSystemTime(new Date("2026-12-20T06:30:00Z")); // 20 Dec 2026, Q4
    dbMock.bill.findMany.mockResolvedValue([]);

    await getTimelineEvents(OWNER_ID, "quarter", "all");

    const call = dbMock.bill.findMany.mock.calls[0]?.[0];
    expect(call?.where?.dueDate).toEqual({
      gte: new Date("2026-10-01"), // 1 Oct 2026
      lt: new Date("2027-01-01"), // 1 Jan 2027, not month index 12
    });
  });

  it("rolls a December 'month' range over into January of the next year", async () => {
    jest.setSystemTime(new Date("2026-12-31T06:30:00Z")); // 31 Dec 2026
    dbMock.bill.findMany.mockResolvedValue([]);

    await getTimelineEvents(OWNER_ID, "month", "all");

    const call = dbMock.bill.findMany.mock.calls[0]?.[0];
    expect(call?.where?.dueDate).toEqual({
      gte: new Date("2026-12-01"),
      lt: new Date("2027-01-01"),
    });
  });

  it("uses the user's calendar month: already July in India, still June in New York", async () => {
    jest.setSystemTime(new Date("2026-06-30T20:00:00Z"));
    dbMock.bill.findMany.mockResolvedValue([]);

    await getTimelineEvents(OWNER_ID, "month", "all", "Asia/Kolkata");
    await getTimelineEvents(OWNER_ID, "month", "all", "America/New_York");

    const [india, newYork] = dbMock.bill.findMany.mock.calls.map(
      ([arg]) => arg?.where?.dueDate,
    );
    expect(india).toEqual({
      gte: new Date("2026-07-01"),
      lt: new Date("2026-08-01"),
    });
    expect(newYork).toEqual({
      gte: new Date("2026-06-01"),
      lt: new Date("2026-07-01"),
    });
  });

  it("adds a type filter for 'inflow' and 'outflow' but not 'all'", async () => {
    dbMock.bill.findMany.mockResolvedValue([]);

    await getTimelineEvents(OWNER_ID, "month", "inflow");
    expect(dbMock.bill.findMany.mock.calls[0]?.[0]?.where).toMatchObject({
      direction: "INFLOW",
    });

    await getTimelineEvents(OWNER_ID, "month", "outflow");
    expect(dbMock.bill.findMany.mock.calls[1]?.[0]?.where).toMatchObject({
      direction: "OUTFLOW",
    });

    await getTimelineEvents(OWNER_ID, "month", "all");
    expect(dbMock.bill.findMany.mock.calls[2]?.[0]?.where).not.toHaveProperty(
      "direction",
    );
  });
});

describe("projected events", () => {
  const NOW = new Date("2026-06-15T06:30:00Z"); // 15 Jun in India

  const premium = {
    id: "sched-1",
    category: "PREMIUM",
    recurrence: "QUARTERLY",
    dueDay: 10,
    dueMonth: null,
    startDate: new Date("2026-04-10"),
    endDate: null,
    createdAt: new Date("2026-04-01"),
    tenureMonths: null,
    defaultAmount: 900_000,
    currency: null,
    policy: { id: "pol-1", insurer: "LIC" },
    property: null,
    lease: null,
    loan: null,
    investment: null,
    billType: null,
    provider: null,
  };

  it("adds what a schedule will bill later in the range", async () => {
    dbMock.bill.findMany.mockResolvedValue([
      {
        id: "bill-1",
        billScheduleId: "sched-1",
        category: "PREMIUM",
        direction: "OUTFLOW",
        dueDate: new Date("2026-07-10"),
        amount: 900_000,
        currency: null,
        status: "DUE",
        description: "LIC premium",
      },
    ] as never);
    dbMock.billSchedule.findMany.mockResolvedValue([premium] as never);

    const events = await getTimelineEvents(
      OWNER_ID,
      "year",
      "all",
      "Asia/Kolkata",
      NOW,
    );

    // April's premium is in the past with no bill: not projected. July's
    // bill exists; October's is projected.
    expect(
      events.map((e) => [
        e.dueDate.toISOString().slice(0, 10),
        e.status,
        e.billId,
      ]),
    ).toEqual([
      ["2026-07-10", "DUE", "bill-1"],
      ["2026-10-10", "PROJECTED", null],
    ]);
    expect(events[1]).toMatchObject({
      projected: true,
      direction: "OUTFLOW",
      amount: 900_000,
      description: "Premium · LIC",
    });
  });

  it("only projects the direction asked for", async () => {
    dbMock.bill.findMany.mockResolvedValue([]);
    dbMock.billSchedule.findMany.mockResolvedValue([premium] as never);

    await expect(
      getTimelineEvents(OWNER_ID, "year", "inflow", "Asia/Kolkata", NOW),
    ).resolves.toEqual([]);
  });

  it("looks only at the household's active schedules", async () => {
    dbMock.bill.findMany.mockResolvedValue([]);

    await getTimelineEvents(OWNER_ID, "month", "all");

    expect(dbMock.billSchedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { householdId: OWNER_ID, active: true },
      }),
    );
  });
});
