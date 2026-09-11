import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { getSession } from "~/server/better-auth/server";
import { generateBill, markBillPaid } from "./bills";

jest.mock("~/server/db");
jest.mock("~/server/better-auth/server", () => ({
  getSession: jest.fn(),
}));
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));
jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;
const getSessionMock = getSession as jest.Mock;
const { redirect } = jest.requireMock("next/navigation") as {
  redirect: jest.Mock;
};
const { revalidatePath } = jest.requireMock("next/cache") as {
  revalidatePath: jest.Mock;
};

const SESSION = { user: { id: "user-1", email: "owner@example.com" } };

beforeEach(() => {
  mockReset(dbMock);
  getSessionMock.mockReset().mockResolvedValue(SESSION);
  redirect.mockClear();
  revalidatePath.mockClear();
});

describe("generateBill", () => {
  it("creates the bill and a matching financial event, reusing category/direction on both", async () => {
    dbMock.bill.create.mockResolvedValue({ id: "bill-1" } as never);
    dbMock.financialEvent.create.mockResolvedValue({ id: "event-1" } as never);

    const dueDate = new Date(2026, 6, 10);
    await generateBill({
      ownerId: "user-1",
      category: "BILL",
      direction: "OUTFLOW",
      sourceId: "utility-1",
      propertyId: "prop-1",
      amount: 1500,
      dueDate,
      description: "BESCOM (Electricity) - Test Flat",
    });

    expect(dbMock.bill.create).toHaveBeenCalledWith({
      data: {
        ownerId: "user-1",
        category: "BILL",
        direction: "OUTFLOW",
        sourceId: "utility-1",
        propertyId: "prop-1",
        dueDate,
        amount: 1500,
        status: "DUE",
      },
    });
    expect(dbMock.financialEvent.create).toHaveBeenCalledWith({
      data: {
        ownerId: "user-1",
        type: "OUTFLOW",
        source: "BILL",
        sourceId: "bill-1",
        amount: 1500,
        dueDate,
        status: "DUE",
        description: "BESCOM (Electricity) - Test Flat",
      },
    });
  });

  it("works for an inflow category with no property (e.g. an EMI, or a rent/premium bill)", async () => {
    dbMock.bill.create.mockResolvedValue({ id: "bill-2" } as never);
    dbMock.financialEvent.create.mockResolvedValue({ id: "event-2" } as never);

    const dueDate = new Date(2026, 8, 5);
    await generateBill({
      ownerId: "user-1",
      category: "EMI",
      direction: "OUTFLOW",
      sourceId: "loan-1",
      amount: 71_250,
      dueDate,
      description: "Home loan EMI - SBI",
    });

    expect(dbMock.bill.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        category: "EMI",
        direction: "OUTFLOW",
        sourceId: "loan-1",
        propertyId: undefined,
      }),
    });
  });

  it("returns the created bill", async () => {
    const created = { id: "bill-1" };
    dbMock.bill.create.mockResolvedValue(created as never);
    dbMock.financialEvent.create.mockResolvedValue({ id: "event-1" } as never);

    const result = await generateBill({
      ownerId: "user-1",
      category: "BILL",
      direction: "OUTFLOW",
      sourceId: "utility-1",
      propertyId: "prop-1",
      amount: 1500,
      dueDate: new Date(2026, 6, 10),
      description: "BESCOM (Electricity) - Test Flat",
    });

    expect(result).toBe(created);
  });
});

describe("markBillPaid", () => {
  function buildPaidForm(paidOn: string | null = "2026-06-15") {
    const formData = new FormData();
    if (paidOn !== null) formData.set("paidOn", paidOn);
    return formData;
  }

  it("redirects to / when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(markBillPaid("bill-1", buildPaidForm())).rejects.toThrow(
      "REDIRECT:/",
    );
  });

  it("throws when the bill doesn't belong to this owner", async () => {
    dbMock.bill.findFirst.mockResolvedValue(null);

    await expect(markBillPaid("bill-1", buildPaidForm())).rejects.toThrow(
      "Bill not found",
    );
    expect(dbMock.bill.update).not.toHaveBeenCalled();
  });

  it("rejects marking paid without a paidOn date", async () => {
    dbMock.bill.findFirst.mockResolvedValue({
      id: "bill-1",
      ownerId: "user-1",
      category: "BILL",
      propertyId: "prop-1",
      amount: 1500,
    } as never);

    await expect(
      markBillPaid("bill-1", buildPaidForm(null)),
    ).rejects.toThrow("Enter the date the bill was paid");
    expect(dbMock.bill.update).not.toHaveBeenCalled();
  });

  it("rejects marking paid with a blank paidOn date", async () => {
    dbMock.bill.findFirst.mockResolvedValue({
      id: "bill-1",
      ownerId: "user-1",
      category: "BILL",
      propertyId: "prop-1",
      amount: 1500,
    } as never);

    await expect(
      markBillPaid("bill-1", buildPaidForm("   ")),
    ).rejects.toThrow("Enter the date the bill was paid");
    expect(dbMock.bill.update).not.toHaveBeenCalled();
  });

  it("rejects an unparseable paidOn date", async () => {
    dbMock.bill.findFirst.mockResolvedValue({
      id: "bill-1",
      ownerId: "user-1",
      category: "BILL",
      propertyId: "prop-1",
      amount: 1500,
    } as never);

    await expect(
      markBillPaid("bill-1", buildPaidForm("not-a-date")),
    ).rejects.toThrow("Enter a valid paid date");
    expect(dbMock.bill.update).not.toHaveBeenCalled();
  });

  it("marks a property-scoped bill paid, syncs its financial event by category, and redirects back to the utilities page", async () => {
    dbMock.bill.findFirst.mockResolvedValue({
      id: "bill-1",
      ownerId: "user-1",
      category: "BILL",
      propertyId: "prop-1",
      amount: 1500,
    } as never);

    await expect(
      markBillPaid("bill-1", buildPaidForm("2026-06-15")),
    ).rejects.toThrow("REDIRECT:/properties/prop-1/utilities");

    expect(dbMock.bill.update).toHaveBeenCalledWith({
      where: { id: "bill-1" },
      data: expect.objectContaining({
        status: "PAID",
        paidAmount: 1500,
        paidDate: new Date("2026-06-15"),
      }),
    });
    expect(dbMock.financialEvent.updateMany).toHaveBeenCalledWith({
      where: { source: "BILL", sourceId: "bill-1" },
      data: { status: "PAID" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/properties/prop-1/utilities");
  });

  it("syncs the financial event using the bill's own category, not a hardcoded one", async () => {
    dbMock.bill.findFirst.mockResolvedValue({
      id: "bill-2",
      ownerId: "user-1",
      category: "EMI",
      propertyId: null,
      amount: 71_250,
    } as never);

    await markBillPaid("bill-2", buildPaidForm());

    expect(dbMock.financialEvent.updateMany).toHaveBeenCalledWith({
      where: { source: "EMI", sourceId: "bill-2" },
      data: { status: "PAID" },
    });
  });

  it("does not redirect for a bill with no propertyId (no dedicated page exists yet)", async () => {
    dbMock.bill.findFirst.mockResolvedValue({
      id: "bill-2",
      ownerId: "user-1",
      category: "EMI",
      propertyId: null,
      amount: 71_250,
    } as never);

    await expect(
      markBillPaid("bill-2", buildPaidForm()),
    ).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("records paidAmount as 0 for a free/zero-amount bill", async () => {
    dbMock.bill.findFirst.mockResolvedValue({
      id: "bill-1",
      ownerId: "user-1",
      category: "BILL",
      propertyId: "prop-1",
      amount: 0,
    } as never);

    await expect(
      markBillPaid("bill-1", buildPaidForm()),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.bill.update).toHaveBeenCalledWith({
      where: { id: "bill-1" },
      data: expect.objectContaining({ paidAmount: 0 }),
    });
  });

  it("is idempotent: marking an already-PAID bill paid again still succeeds", async () => {
    dbMock.bill.findFirst.mockResolvedValue({
      id: "bill-1",
      ownerId: "user-1",
      category: "BILL",
      propertyId: "prop-1",
      amount: 1500,
      status: "PAID",
    } as never);

    await expect(
      markBillPaid("bill-1", buildPaidForm()),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.bill.update).toHaveBeenCalledWith({
      where: { id: "bill-1" },
      data: expect.objectContaining({ status: "PAID" }),
    });
  });
});
