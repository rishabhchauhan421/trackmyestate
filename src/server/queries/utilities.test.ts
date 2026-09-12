import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import {
  getActiveUtilitiesForProperty,
  getUtilityBillsForProperty,
} from "~/server/queries/utilities";

jest.mock("~/server/db");

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(dbMock);
});

describe("getActiveUtilitiesForProperty", () => {
  it("only queries active UTILITY_BILL-category schedules for the given property", async () => {
    dbMock.billSchedule.findMany.mockResolvedValue([]);

    await getActiveUtilitiesForProperty("prop-1");

    const call = dbMock.billSchedule.findMany.mock.calls[0]?.[0];
    expect(call?.where).toEqual({
      propertyId: "prop-1",
      category: "UTILITY_BILL",
      active: true,
    });
  });

  it("does not mix up recipients between different utilities", async () => {
    dbMock.billSchedule.findMany.mockResolvedValue([
      {
        id: "utility-1",
        billType: "ELECTRICITY",
        recipients: [{ email: "u1@x.com" }],
      },
      { id: "utility-2", billType: "WATER", recipients: [] },
      {
        id: "utility-3",
        billType: "GAS",
        recipients: [{ email: "u3@x.com" }],
      },
    ] as never);

    const result = await getActiveUtilitiesForProperty("prop-1");

    expect(result[0]?.recipients).toEqual([{ email: "u1@x.com" }]);
    expect(result[1]?.recipients).toEqual([]);
    expect(result[2]?.recipients).toEqual([{ email: "u3@x.com" }]);
  });

  it("returns an empty array when the property has no active utilities", async () => {
    dbMock.billSchedule.findMany.mockResolvedValue([]);

    const result = await getActiveUtilitiesForProperty("prop-1");

    expect(result).toEqual([]);
  });

  it("exposes billType back as `type`, its field name back when this was `Utility`", async () => {
    dbMock.billSchedule.findMany.mockResolvedValue([
      { id: "utility-1", billType: "ELECTRICITY", recipients: [] },
    ] as never);

    const result = await getActiveUtilitiesForProperty("prop-1");

    expect(result[0]?.type).toBe("ELECTRICITY");
  });
});

describe("getUtilityBillsForProperty", () => {
  it("queries every UTILITY_BILL-category Bill for the property, not scoped to active utilities", async () => {
    dbMock.bill.findMany.mockResolvedValue([]);

    await getUtilityBillsForProperty("prop-1");

    const call = dbMock.bill.findMany.mock.calls[0]?.[0];
    expect(call?.where).toEqual({
      propertyId: "prop-1",
      category: "UTILITY_BILL",
    });
  });

  it("orders bills by due date, newest first", async () => {
    dbMock.bill.findMany.mockResolvedValue([]);

    await getUtilityBillsForProperty("prop-1");

    const call = dbMock.bill.findMany.mock.calls[0]?.[0];
    expect(call?.orderBy).toEqual({ dueDate: "desc" });
  });

  it("attaches the parent utility's type/provider/active for display, fetched separately via billScheduleId", async () => {
    dbMock.bill.findMany.mockResolvedValue([
      { id: "bill-1", billScheduleId: "utility-1" },
    ] as never);
    dbMock.billSchedule.findMany.mockResolvedValue([
      { id: "utility-1", billType: "ELECTRICITY", provider: "BESCOM", active: true },
    ] as never);

    const result = await getUtilityBillsForProperty("prop-1");

    const utilityCall = dbMock.billSchedule.findMany.mock.calls[0]?.[0];
    expect(utilityCall?.where).toEqual({ id: { in: ["utility-1"] } });
    expect(utilityCall?.select).toEqual({
      id: true,
      billType: true,
      provider: true,
      active: true,
    });
    expect(result[0]?.utility).toEqual({
      type: "ELECTRICITY",
      provider: "BESCOM",
      active: true,
    });
  });

  it("returns an empty array when nothing has been generated yet", async () => {
    dbMock.bill.findMany.mockResolvedValue([]);

    const result = await getUtilityBillsForProperty("prop-1");

    expect(result).toEqual([]);
    expect(dbMock.billSchedule.findMany).not.toHaveBeenCalled();
  });

  it("still returns bills belonging to a now-inactive utility", async () => {
    dbMock.bill.findMany.mockResolvedValue([
      { id: "bill-1", billScheduleId: "utility-1" },
    ] as never);
    dbMock.billSchedule.findMany.mockResolvedValue([
      { id: "utility-1", billType: "ELECTRICITY", provider: "BESCOM", active: false },
    ] as never);

    const result = await getUtilityBillsForProperty("prop-1");

    expect(result[0]?.utility.active).toBe(false);
  });
});
