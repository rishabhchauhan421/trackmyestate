import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { getLoanForOwner, getLoans } from "~/server/queries/loans";

jest.mock("~/server/db");

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(dbMock);
});

describe("getLoanForOwner", () => {
  it("returns null for a loan that doesn't exist or isn't owned by this user", async () => {
    dbMock.loan.findFirst.mockResolvedValue(null);

    const result = await getLoanForOwner("loan-1", "owner-1");

    expect(result).toBeNull();
    expect(dbMock.billSchedule.findFirst).not.toHaveBeenCalled();
  });

  it("flattens the loan's EMI BillSchedule back onto its old field names", async () => {
    dbMock.loan.findFirst.mockResolvedValue({
      id: "loan-1",
      ownerId: "owner-1",
      lender: "HDFC Bank",
    } as never);
    dbMock.billSchedule.findFirst.mockResolvedValue({
      dueDay: 5,
      defaultAmount: 43_000,
      tenureMonths: 240,
    } as never);

    const result = await getLoanForOwner("loan-1", "owner-1");

    const scheduleCall = dbMock.billSchedule.findFirst.mock.calls[0]?.[0];
    expect(scheduleCall?.where).toEqual({ category: "EMI", loanId: "loan-1" });
    expect(result).toMatchObject({
      id: "loan-1",
      lender: "HDFC Bank",
      emiDueDay: 5,
      emiAmount: 43_000,
      tenureMonths: 240,
    });
  });
});

describe("getLoans", () => {
  it("attaches the linked property's name for a loan with linkedPropertyId set", async () => {
    dbMock.loan.findMany.mockResolvedValue([
      { id: "loan-1", linkedPropertyId: "prop-1" },
      { id: "loan-2", linkedPropertyId: null },
    ] as never);
    dbMock.bill.findMany.mockResolvedValue([]);
    dbMock.property.findMany.mockResolvedValue([
      { id: "prop-1", name: "Whitefield Flat" },
    ] as never);

    const result = await getLoans("owner-1");

    const propertyCall = dbMock.property.findMany.mock.calls[0]?.[0];
    expect(propertyCall?.where).toEqual({ id: { in: ["prop-1"] } });
    expect(result[0]?.linkedPropertyName).toBe("Whitefield Flat");
    expect(result[1]?.linkedPropertyName).toBeNull();
  });

  it("skips the property lookup entirely when no loan is linked", async () => {
    dbMock.loan.findMany.mockResolvedValue([
      { id: "loan-1", linkedPropertyId: null },
    ] as never);
    dbMock.bill.findMany.mockResolvedValue([]);

    const result = await getLoans("owner-1");

    expect(dbMock.property.findMany).not.toHaveBeenCalled();
    expect(result[0]?.linkedPropertyName).toBeNull();
  });
});
