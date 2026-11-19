import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { createBill, isUniqueConstraintError, scheduleBillKey } from "./create";

jest.mock("~/server/db");

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(dbMock);
});

describe("createBill", () => {
  it("creates the bill with its category/direction and asset-specific foreign key", async () => {
    dbMock.bill.create.mockResolvedValue({ id: "bill-1" } as never);

    await createBill({
      ownerId: "user-1",
      category: "UTILITY_BILL",
      direction: "OUTFLOW",
      billScheduleId: "utility-1",
      propertyId: "prop-1",
      amount: 1500,
      dueDay: "2026-07-10",
      description: "BESCOM (Electricity) - Test Flat",
    });

    expect(dbMock.bill.create).toHaveBeenCalledWith({
      data: {
        ownerId: "user-1",
        category: "UTILITY_BILL",
        direction: "OUTFLOW",
        billScheduleId: "utility-1",
        propertyId: "prop-1",
        leaseId: undefined,
        loanId: undefined,
        policyId: undefined,
        investmentId: undefined,
        // Stored as midnight UTC of the calendar day, whatever the server's
        // time zone.
        dueDate: new Date("2026-07-10T00:00:00.000Z"),
        amount: 1500,
        status: "DUE",
        description: "BESCOM (Electricity) - Test Flat",
        householdId: undefined,
        installmentNumber: undefined,
        generationKey: undefined,
      },
    });
  });

  it("works for a loan-linked category with no property (e.g. an EMI)", async () => {
    dbMock.bill.create.mockResolvedValue({ id: "bill-2" } as never);

    await createBill({
      ownerId: "user-1",
      category: "EMI",
      direction: "OUTFLOW",
      loanId: "loan-1",
      amount: 71_250,
      dueDay: "2026-09-05",
      description: "Home loan EMI - SBI",
    });

    expect(dbMock.bill.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        category: "EMI",
        direction: "OUTFLOW",
        loanId: "loan-1",
        propertyId: undefined,
      }),
    });
  });

  it("returns the created bill", async () => {
    const created = { id: "bill-1" };
    dbMock.bill.create.mockResolvedValue(created as never);

    const result = await createBill({
      ownerId: "user-1",
      category: "UTILITY_BILL",
      direction: "OUTFLOW",
      billScheduleId: "utility-1",
      propertyId: "prop-1",
      amount: 1500,
      dueDay: "2026-07-10",
      description: "BESCOM (Electricity) - Test Flat",
    });

    expect(result).toBe(created);
  });

  it("refuses something that isn't a calendar day", async () => {
    await expect(
      createBill({
        ownerId: "user-1",
        category: "EMI",
        direction: "OUTFLOW",
        loanId: "loan-1",
        amount: 1,
        dueDay: "2026-02-30",
        description: "x",
      }),
    ).rejects.toThrow("Not a calendar day");
    expect(dbMock.bill.create).not.toHaveBeenCalled();
  });
});

describe("scheduleBillKey", () => {
  it("is the schedule and the calendar day", () => {
    expect(scheduleBillKey("sched-1", "2026-07-10")).toBe("sched-1:2026-07-10");
  });
});

describe("isUniqueConstraintError", () => {
  it("recognises Prisma's P2002", () => {
    expect(isUniqueConstraintError({ code: "P2002" })).toBe(true);
    expect(isUniqueConstraintError(new Error("boom"))).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
  });
});
