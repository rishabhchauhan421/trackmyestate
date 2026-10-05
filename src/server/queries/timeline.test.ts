import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { getTimelineEvents } from "~/server/queries/timeline";

jest.mock("~/server/db");

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;

const OWNER_ID = "owner-1";

beforeEach(() => {
  mockReset(dbMock);
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
