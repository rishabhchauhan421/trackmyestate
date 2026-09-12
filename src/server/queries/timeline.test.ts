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
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 15)); // 15 Jun 2026
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("bounds a 'month' range to the current calendar month", async () => {
    dbMock.bill.findMany.mockResolvedValue([]);

    await getTimelineEvents(OWNER_ID, "month", "all");

    const call = dbMock.bill.findMany.mock.calls[0]?.[0];
    expect(call?.where?.dueDate).toEqual({
      gte: new Date(2026, 5, 1),
      lt: new Date(2026, 6, 1),
    });
  });

  it("bounds a 'quarter' range to the current calendar quarter", async () => {
    dbMock.bill.findMany.mockResolvedValue([]);

    await getTimelineEvents(OWNER_ID, "quarter", "all");

    const call = dbMock.bill.findMany.mock.calls[0]?.[0];
    // June (month index 5) falls in Q2: Apr(3)-Jun(5)
    expect(call?.where?.dueDate).toEqual({
      gte: new Date(2026, 3, 1),
      lt: new Date(2026, 6, 1),
    });
  });

  it("bounds a 'year' range to the current calendar year", async () => {
    dbMock.bill.findMany.mockResolvedValue([]);

    await getTimelineEvents(OWNER_ID, "year", "all");

    const call = dbMock.bill.findMany.mock.calls[0]?.[0];
    expect(call?.where?.dueDate).toEqual({
      gte: new Date(2026, 0, 1),
      lt: new Date(2027, 0, 1),
    });
  });

  it("rolls a Q4 quarter over into January of the next year", async () => {
    jest.setSystemTime(new Date(2026, 11, 20)); // 20 Dec 2026, Q4
    dbMock.bill.findMany.mockResolvedValue([]);

    await getTimelineEvents(OWNER_ID, "quarter", "all");

    const call = dbMock.bill.findMany.mock.calls[0]?.[0];
    expect(call?.where?.dueDate).toEqual({
      gte: new Date(2026, 9, 1), // 1 Oct 2026
      lt: new Date(2027, 0, 1), // 1 Jan 2027, not month index 12
    });
  });

  it("rolls a December 'month' range over into January of the next year", async () => {
    jest.setSystemTime(new Date(2026, 11, 31)); // 31 Dec 2026
    dbMock.bill.findMany.mockResolvedValue([]);

    await getTimelineEvents(OWNER_ID, "month", "all");

    const call = dbMock.bill.findMany.mock.calls[0]?.[0];
    expect(call?.where?.dueDate).toEqual({
      gte: new Date(2026, 11, 1),
      lt: new Date(2027, 0, 1),
    });
  });

  it("adds a type filter for 'inflow' and 'outflow' but not 'all'", async () => {
    dbMock.bill.findMany.mockResolvedValue([]);

    await getTimelineEvents(OWNER_ID, "month", "inflow");
    expect(
      dbMock.bill.findMany.mock.calls[0]?.[0]?.where,
    ).toMatchObject({ direction: "INFLOW" });

    await getTimelineEvents(OWNER_ID, "month", "outflow");
    expect(
      dbMock.bill.findMany.mock.calls[1]?.[0]?.where,
    ).toMatchObject({ direction: "OUTFLOW" });

    await getTimelineEvents(OWNER_ID, "month", "all");
    expect(
      dbMock.bill.findMany.mock.calls[2]?.[0]?.where,
    ).not.toHaveProperty("direction");
  });
});
