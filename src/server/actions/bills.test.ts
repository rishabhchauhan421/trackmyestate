import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { HOUSEHOLD_ID } from "~/server/__testing__/households-mock";
import { recordBillPayment } from "./bills";

jest.mock("~/server/db");
jest.mock("~/server/households", () =>
  jest.requireActual<Record<string, unknown>>(
    "~/server/__testing__/households-mock",
  ),
);
jest.mock("~/server/better-auth/server", () => ({ getSession: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;
const getSessionMock = getSession as jest.Mock;
const { revalidatePath } = jest.requireMock<{ revalidatePath: jest.Mock }>(
  "next/cache",
);

/** ₹1,500.00 due, in paise. */
const BILL = {
  id: "bill-1",
  ownerId: "user-1",
  householdId: HOUSEHOLD_ID,
  category: "UTILITY_BILL",
  direction: "OUTFLOW",
  propertyId: "prop-1",
  leaseId: null,
  loanId: null,
  policyId: null,
  investmentId: null,
  currency: null,
  amount: 150_000,
  paidAmount: null,
  status: "DUE",
};

function paymentForm(fields: Record<string, string> = {}) {
  const all: Record<string, string> = {
    paidOn: "2026-06-15",
    amount: "1500",
    method: "UPI",
    reference: "UTR123",
    settles: "on",
    ...fields,
  };
  const formData = new FormData();
  for (const [key, value] of Object.entries(all)) {
    if (value !== "") formData.set(key, value);
  }
  return formData;
}

function billIs(bill: Record<string, unknown>) {
  dbMock.bill.findFirst.mockResolvedValue({ ...BILL, ...bill } as never);
}

beforeEach(() => {
  mockReset(dbMock);
  revalidatePath.mockClear();
  getSessionMock.mockReset().mockResolvedValue({ user: { id: "user-1" } });
  dbMock.$transaction.mockImplementation((async (
    fn: (tx: typeof dbMock) => Promise<unknown>,
  ) => fn(dbMock)));
  billIs({});
});

describe("recordBillPayment", () => {
  it("sends a signed-out visitor to sign in", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(recordBillPayment("bill-1", paymentForm())).rejects.toThrow(
      "REDIRECT:/login",
    );
  });

  it("refuses a bill outside the household", async () => {
    dbMock.bill.findFirst.mockResolvedValue(null);
    await expect(recordBillPayment("bill-1", paymentForm())).rejects.toThrow(
      "Bill not found",
    );
    expect(dbMock.bill.findFirst).toHaveBeenCalledWith({
      where: { id: "bill-1", householdId: HOUSEHOLD_ID },
    });
  });

  it("records the payment and marks the bill paid", async () => {
    await expect(recordBillPayment("bill-1", paymentForm())).rejects.toThrow(
      "REDIRECT:/bills/bill-1?saved=1",
    );

    expect(dbMock.paymentTransaction.create).toHaveBeenCalledWith({
      data: {
        ownerId: "user-1",
        householdId: HOUSEHOLD_ID,
        category: "UTILITY_BILL",
        billId: "bill-1",
        propertyId: "prop-1",
        leaseId: null,
        loanId: null,
        policyId: null,
        investmentId: null,
        amount: 150_000,
        currency: null,
        paymentMethod: "UPI",
        referenceNumber: "UTR123",
        paidAt: new Date("2026-06-15"),
      },
    });
    expect(dbMock.bill.update).toHaveBeenCalledWith({
      where: { id: "bill-1" },
      data: {
        paidAmount: 150_000,
        status: "PAID",
        paidDate: new Date("2026-06-15"),
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledWith("/properties/prop-1/utilities");
  });

  it("settles a variable bill at a different amount when ticked", async () => {
    await expect(
      recordBillPayment("bill-1", paymentForm({ amount: "1234.50" })),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.bill.update).toHaveBeenCalledWith({
      where: { id: "bill-1" },
      data: expect.objectContaining({ paidAmount: 123_450, status: "PAID" }),
    });
  });

  it("leaves a part payment open", async () => {
    await expect(
      recordBillPayment("bill-1", paymentForm({ amount: "500", settles: "" })),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.bill.update).toHaveBeenCalledWith({
      where: { id: "bill-1" },
      data: { paidAmount: 50_000, status: "PARTIALLY_PAID", paidDate: null },
    });
  });

  it("adds to earlier part payments and closes once covered", async () => {
    billIs({ status: "PARTIALLY_PAID", paidAmount: 50_000 });

    await expect(
      recordBillPayment("bill-1", paymentForm({ amount: "1000", settles: "" })),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.bill.update).toHaveBeenCalledWith({
      where: { id: "bill-1" },
      data: {
        paidAmount: 150_000,
        status: "PAID",
        paidDate: new Date("2026-06-15"),
      },
    });
  });

  it("ignores a stale paidAmount on a bill that isn't part-paid", async () => {
    billIs({ status: "OVERDUE", paidAmount: 99_999 });

    await expect(
      recordBillPayment("bill-1", paymentForm({ amount: "100", settles: "" })),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.bill.update).toHaveBeenCalledWith({
      where: { id: "bill-1" },
      data: expect.objectContaining({ paidAmount: 10_000 }),
    });
  });

  it.each(["PAID", "CANCELLED", "REFUNDED"])(
    "refuses a %s bill",
    async (status) => {
      billIs({ status });
      await expect(recordBillPayment("bill-1", paymentForm())).rejects.toThrow(
        "This bill is already closed",
      );
      expect(dbMock.paymentTransaction.create).not.toHaveBeenCalled();
    },
  );

  it("refuses when another payment closed it first", async () => {
    dbMock.bill.findFirst
      .mockResolvedValueOnce(BILL as never)
      .mockResolvedValueOnce({ ...BILL, status: "PAID" } as never);

    await expect(recordBillPayment("bill-1", paymentForm())).rejects.toThrow(
      "This bill is already closed",
    );
    expect(dbMock.paymentTransaction.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ paidOn: "" }, "Enter the date it was paid"],
    [{ paidOn: "not-a-date" }, "Enter a valid date"],
    [{ amount: "" }, "Enter the amount paid"],
    [{ amount: "0" }, "Enter an amount greater than zero"],
    [{ method: "BARTER" }, "Choose how it was paid"],
  ])("rejects %p", async (fields, message) => {
    await expect(
      recordBillPayment("bill-1", paymentForm(fields)),
    ).rejects.toThrow(message);
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });
});
