import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { signBillPaid } from "~/server/bills/paid-link";
import { db } from "~/server/db";
import { markBillPaidFromLink } from "./bill-paid-link";

jest.mock("~/env", () => ({
  env: {
    BETTER_AUTH_SECRET: "test-secret",
    NEXT_PUBLIC_SITE_URL: "https://trackmyestate.app",
  },
}));
jest.mock("~/server/db");
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;
const { revalidatePath } = jest.requireMock<{ revalidatePath: jest.Mock }>(
  "next/cache",
);

/** ₹1,500.00 due, in paise. The owner is in India. */
const BILL = {
  id: "bill-1",
  ownerId: "user-1",
  householdId: "household-1",
  category: "UTILITY_BILL",
  direction: "OUTFLOW",
  propertyId: "prop-1",
  leaseId: null,
  loanId: null,
  policyId: null,
  investmentId: null,
  principalComponent: null,
  currency: null,
  amount: 150_000,
  paidAmount: null,
  status: "DUE",
  owner: { timezone: "Asia/Kolkata" },
};

function billIs(bill: Record<string, unknown> | null) {
  dbMock.bill.findFirst.mockResolvedValue(
    (bill ? { ...BILL, ...bill } : null) as never,
  );
}

function form(method = "UPI") {
  const formData = new FormData();
  formData.set("method", method);
  return formData;
}

const SIG = signBillPaid("bill-1");
const DONE = `REDIRECT:/reminders/paid?bill=bill-1&sig=${SIG}&done=1`;

beforeEach(() => {
  mockReset(dbMock);
  revalidatePath.mockClear();
  dbMock.$transaction.mockImplementation(
    async (fn: (tx: typeof dbMock) => Promise<unknown>) => fn(dbMock),
  );
  billIs({});
  // 20:00 UTC on 14 Jun is already 15 Jun in India.
  jest.useFakeTimers().setSystemTime(new Date("2026-06-14T20:00:00Z"));
});

afterEach(() => {
  jest.useRealTimers();
});

describe("markBillPaidFromLink", () => {
  it("settles the bill in full, dated today where the owner is", async () => {
    await expect(markBillPaidFromLink("bill-1", SIG, form())).rejects.toThrow(
      DONE,
    );

    expect(dbMock.paymentTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: "user-1",
        householdId: "household-1",
        billId: "bill-1",
        amount: 150_000,
        paymentMethod: "UPI",
        paidAt: new Date("2026-06-15T00:00:00Z"),
      }) as unknown,
    });
    expect(dbMock.bill.update).toHaveBeenCalledWith({
      where: { id: "bill-1" },
      data: {
        paidAmount: 150_000,
        status: "PAID",
        paidDate: new Date("2026-06-15T00:00:00Z"),
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/bills/bill-1");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });

  it("pays only what's left on a partly paid bill", async () => {
    billIs({ status: "PARTIALLY_PAID", paidAmount: 50_000 });

    await expect(
      markBillPaidFromLink("bill-1", SIG, form("CASH")),
    ).rejects.toThrow(DONE);

    expect(dbMock.paymentTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 100_000,
        paymentMethod: "CASH",
      }) as unknown,
    });
    expect(dbMock.bill.update).toHaveBeenCalledWith({
      where: { id: "bill-1" },
      data: expect.objectContaining({
        paidAmount: 150_000,
        status: "PAID",
      }) as unknown,
    });
  });

  it("takes a paid EMI's principal off the loan", async () => {
    billIs({ category: "EMI", loanId: "loan-1", principalComponent: 40_000 });
    dbMock.loan.findFirst.mockResolvedValue({
      outstandingBalance: 1_000_000,
    } as never);

    await expect(markBillPaidFromLink("bill-1", SIG, form())).rejects.toThrow(
      DONE,
    );

    expect(dbMock.loan.update).toHaveBeenCalledWith({
      where: { id: "loan-1" },
      data: { outstandingBalance: 960_000 },
    });
  });

  it("writes nothing when the bill is already paid", async () => {
    billIs({ status: "PAID", paidAmount: 150_000 });

    await expect(markBillPaidFromLink("bill-1", SIG, form())).rejects.toThrow(
      DONE,
    );

    expect(dbMock.paymentTransaction.create).not.toHaveBeenCalled();
    expect(dbMock.bill.update).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects a signature for another bill before reading anything", async () => {
    await expect(
      markBillPaidFromLink("bill-1", signBillPaid("bill-2"), form()),
    ).rejects.toThrow("This link isn't valid");

    expect(dbMock.bill.findFirst).not.toHaveBeenCalled();
    expect(dbMock.paymentTransaction.create).not.toHaveBeenCalled();
  });

  it("rejects a link to a bill that no longer exists", async () => {
    billIs(null);

    await expect(markBillPaidFromLink("bill-1", SIG, form())).rejects.toThrow(
      "This link isn't valid",
    );

    expect(dbMock.paymentTransaction.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown payment method", async () => {
    await expect(
      markBillPaidFromLink("bill-1", SIG, form("BARTER")),
    ).rejects.toThrow("Choose how it was paid");

    expect(dbMock.paymentTransaction.create).not.toHaveBeenCalled();
  });
});
