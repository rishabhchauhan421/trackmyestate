import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { getAllBillsForProperty, getBillsForProperty } from "~/server/queries/bills";

jest.mock("~/server/db");

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(dbMock);
});

describe("getBillsForProperty", () => {
  it("queries bills scoped to the property and category, newest due date first", async () => {
    dbMock.bill.findMany.mockResolvedValue([]);

    await getBillsForProperty("prop-1", "UTILITY_BILL");

    const call = dbMock.bill.findMany.mock.calls[0]?.[0];
    expect(call?.where).toEqual({ propertyId: "prop-1", category: "UTILITY_BILL" });
    expect(call?.orderBy).toEqual({ dueDate: "desc" });
  });
});

describe("getAllBillsForProperty", () => {
  it("queries every bill directly scoped to the property when it has no linked loan", async () => {
    dbMock.loan.findMany.mockResolvedValue([]);
    dbMock.bill.findMany.mockResolvedValue([]);

    await getAllBillsForProperty("prop-1");

    expect(dbMock.loan.findMany).toHaveBeenCalledWith({
      where: { linkedPropertyId: "prop-1" },
      select: { id: true },
    });
    const call = dbMock.bill.findMany.mock.calls[0]?.[0];
    expect(call?.where).toEqual({ OR: [{ propertyId: "prop-1" }] });
    expect(call?.orderBy).toEqual({ dueDate: "desc" });
  });

  it("also pulls in EMI bills from any loan linked to this property", async () => {
    dbMock.loan.findMany.mockResolvedValue([
      { id: "loan-1" },
      { id: "loan-2" },
    ] as never);
    dbMock.bill.findMany.mockResolvedValue([]);

    await getAllBillsForProperty("prop-1");

    const call = dbMock.bill.findMany.mock.calls[0]?.[0];
    expect(call?.where).toEqual({
      OR: [{ propertyId: "prop-1" }, { loanId: { in: ["loan-1", "loan-2"] } }],
    });
  });

  it("returns an empty array when the property has no bills at all", async () => {
    dbMock.loan.findMany.mockResolvedValue([]);
    dbMock.bill.findMany.mockResolvedValue([]);

    const result = await getAllBillsForProperty("prop-1");

    expect(result).toEqual([]);
  });
});
