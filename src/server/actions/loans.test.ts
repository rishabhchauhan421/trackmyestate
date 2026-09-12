import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { getSession } from "~/server/better-auth/server";
import { createLoan, deleteLoan, updateLoan } from "./loans";

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

function buildLoanForm(overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    lender: "HDFC Bank",
    type: "HOME_LOAN",
    principal: "5000000",
    interestRatePercent: "8.5",
    tenureMonths: "240",
    emiAmount: "43000",
    emiDueDay: "5",
    startDate: "2024-04-05",
    outstandingBalance: "4800000",
    ...overrides,
  };

  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return formData;
}

describe("createLoan", () => {
  it("redirects to / when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(createLoan(buildLoanForm())).rejects.toThrow("REDIRECT:/");
  });

  it("rejects a missing lender", async () => {
    await expect(
      createLoan(buildLoanForm({ lender: "   " })),
    ).rejects.toThrow("Enter a lender");
    expect(dbMock.loan.create).not.toHaveBeenCalled();
  });

  it("rejects a non-positive principal", async () => {
    await expect(
      createLoan(buildLoanForm({ principal: "0" })),
    ).rejects.toThrow("Enter a valid principal amount");
    expect(dbMock.loan.create).not.toHaveBeenCalled();
  });

  it("rejects a negative interest rate", async () => {
    await expect(
      createLoan(buildLoanForm({ interestRatePercent: "-1" })),
    ).rejects.toThrow("Enter a valid interest rate");
    expect(dbMock.loan.create).not.toHaveBeenCalled();
  });

  it("rejects a non-integer tenure", async () => {
    await expect(
      createLoan(buildLoanForm({ tenureMonths: "12.5" })),
    ).rejects.toThrow("Enter a valid tenure in months");
    expect(dbMock.loan.create).not.toHaveBeenCalled();
  });

  it("rejects a non-positive EMI amount", async () => {
    await expect(
      createLoan(buildLoanForm({ emiAmount: "0" })),
    ).rejects.toThrow("Enter a valid EMI amount");
    expect(dbMock.loan.create).not.toHaveBeenCalled();
  });

  it("rejects an EMI due day outside 1-31", async () => {
    await expect(
      createLoan(buildLoanForm({ emiDueDay: "32" })),
    ).rejects.toThrow("Enter a valid EMI due day (1-31)");
    await expect(
      createLoan(buildLoanForm({ emiDueDay: "0" })),
    ).rejects.toThrow("Enter a valid EMI due day (1-31)");
    expect(dbMock.loan.create).not.toHaveBeenCalled();
  });

  it("rejects an unparseable start date", async () => {
    await expect(
      createLoan(buildLoanForm({ startDate: "" })),
    ).rejects.toThrow("Enter a valid start date");
    expect(dbMock.loan.create).not.toHaveBeenCalled();
  });

  it("rejects a negative outstanding balance", async () => {
    await expect(
      createLoan(buildLoanForm({ outstandingBalance: "-1" })),
    ).rejects.toThrow("Enter a valid outstanding balance");
    expect(dbMock.loan.create).not.toHaveBeenCalled();
  });

  it("defaults outstandingBalance to the principal when left blank", async () => {
    dbMock.loan.create.mockResolvedValue({ id: "loan-1" } as never);

    await expect(
      createLoan(buildLoanForm({ outstandingBalance: "" })),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.loan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        principal: 5000000,
        outstandingBalance: 5000000,
      }),
    });
  });

  it("creates the loan scoped to the signed-in owner, then redirects", async () => {
    dbMock.loan.create.mockResolvedValue({ id: "loan-1" } as never);

    await expect(createLoan(buildLoanForm())).rejects.toThrow(
      "REDIRECT:/loans",
    );

    expect(dbMock.loan.create).toHaveBeenCalledWith({
      data: {
        ownerId: "user-1",
        lender: "HDFC Bank",
        type: "HOME_LOAN",
        principal: 5000000,
        interestRatePercent: 8.5,
        startDate: new Date("2024-04-05"),
        outstandingBalance: 4800000,
        linkedPropertyId: null,
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/loans");
  });

  // The EMI schedule (tenure, EMI amount, due day) lives on its own
  // `BillSchedule` row, not on `Loan` — see the model comment in
  // `prisma/schema.prisma`.
  it("also creates the loan's EMI BillSchedule, linked by loanId", async () => {
    dbMock.loan.create.mockResolvedValue({ id: "loan-1" } as never);

    await expect(createLoan(buildLoanForm())).rejects.toThrow("REDIRECT:");

    expect(dbMock.billSchedule.create).toHaveBeenCalledWith({
      data: {
        ownerId: "user-1",
        category: "EMI",
        loanId: "loan-1",
        recurrence: "MONTHLY",
        dueDay: 5,
        defaultAmount: 43000,
        tenureMonths: 240,
      },
    });
  });

  it("links the loan to an owned property when linkedPropertyId is given", async () => {
    dbMock.property.findFirst.mockResolvedValue({ id: "prop-1" } as never);
    dbMock.loan.create.mockResolvedValue({ id: "loan-1" } as never);

    await expect(
      createLoan(buildLoanForm({ linkedPropertyId: "prop-1" })),
    ).rejects.toThrow("REDIRECT:/loans");

    expect(dbMock.property.findFirst).toHaveBeenCalledWith({
      where: { id: "prop-1", ownerId: "user-1" },
    });
    expect(dbMock.loan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ linkedPropertyId: "prop-1" }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/properties/prop-1");
  });

  it("rejects a linkedPropertyId that doesn't belong to this owner", async () => {
    dbMock.property.findFirst.mockResolvedValue(null);

    await expect(
      createLoan(buildLoanForm({ linkedPropertyId: "someone-elses-prop" })),
    ).rejects.toThrow("Property not found");
    expect(dbMock.loan.create).not.toHaveBeenCalled();
  });
});

describe("updateLoan", () => {
  it("redirects to / when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(updateLoan("loan-1", buildLoanForm())).rejects.toThrow(
      "REDIRECT:/",
    );
  });

  it("throws when the loan doesn't belong to this owner", async () => {
    dbMock.loan.findFirst.mockResolvedValue(null);

    await expect(updateLoan("loan-1", buildLoanForm())).rejects.toThrow(
      "Loan not found",
    );
    expect(dbMock.loan.update).not.toHaveBeenCalled();
  });

  it("rejects invalid fields before writing anything", async () => {
    dbMock.loan.findFirst.mockResolvedValue({
      id: "loan-1",
      ownerId: "user-1",
    } as never);

    await expect(
      updateLoan("loan-1", buildLoanForm({ emiAmount: "-1" })),
    ).rejects.toThrow("Enter a valid EMI amount");
    expect(dbMock.loan.update).not.toHaveBeenCalled();
  });

  it("updates every editable loan field, then redirects", async () => {
    dbMock.loan.findFirst.mockResolvedValue({
      id: "loan-1",
      ownerId: "user-1",
    } as never);
    dbMock.loan.update.mockResolvedValue({ id: "loan-1" } as never);

    await expect(
      updateLoan(
        "loan-1",
        buildLoanForm({ outstandingBalance: "4700000" }),
      ),
    ).rejects.toThrow("REDIRECT:/loans");

    expect(dbMock.loan.update).toHaveBeenCalledWith({
      where: { id: "loan-1" },
      data: expect.objectContaining({ outstandingBalance: 4700000 }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/loans");
  });

  // The EMI schedule lives on a separate `BillSchedule` row, found by
  // `loanId`/`category` rather than a fetched id.
  it("also updates the loan's EMI BillSchedule fields", async () => {
    dbMock.loan.findFirst.mockResolvedValue({
      id: "loan-1",
      ownerId: "user-1",
    } as never);
    dbMock.loan.update.mockResolvedValue({ id: "loan-1" } as never);

    await expect(
      updateLoan(
        "loan-1",
        buildLoanForm({ emiAmount: "44000", emiDueDay: "10", tenureMonths: "180" }),
      ),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.billSchedule.updateMany).toHaveBeenCalledWith({
      where: { category: "EMI", loanId: "loan-1" },
      data: { dueDay: 10, defaultAmount: 44000, tenureMonths: 180 },
    });
  });

  it("re-links the loan to a different owned property and revalidates both", async () => {
    dbMock.loan.findFirst.mockResolvedValue({
      id: "loan-1",
      ownerId: "user-1",
      linkedPropertyId: "prop-old",
    } as never);
    dbMock.property.findFirst.mockResolvedValue({ id: "prop-new" } as never);
    dbMock.loan.update.mockResolvedValue({ id: "loan-1" } as never);

    await expect(
      updateLoan("loan-1", buildLoanForm({ linkedPropertyId: "prop-new" })),
    ).rejects.toThrow("REDIRECT:/loans");

    expect(dbMock.loan.update).toHaveBeenCalledWith({
      where: { id: "loan-1" },
      data: expect.objectContaining({ linkedPropertyId: "prop-new" }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/properties/prop-old");
    expect(revalidatePath).toHaveBeenCalledWith("/properties/prop-new");
  });

  it("rejects a linkedPropertyId that doesn't belong to this owner", async () => {
    dbMock.loan.findFirst.mockResolvedValue({
      id: "loan-1",
      ownerId: "user-1",
      linkedPropertyId: null,
    } as never);
    dbMock.property.findFirst.mockResolvedValue(null);

    await expect(
      updateLoan(
        "loan-1",
        buildLoanForm({ linkedPropertyId: "someone-elses-prop" }),
      ),
    ).rejects.toThrow("Property not found");
    expect(dbMock.loan.update).not.toHaveBeenCalled();
  });
});

describe("deleteLoan", () => {
  it("redirects to / when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(deleteLoan("loan-1")).rejects.toThrow("REDIRECT:/");
  });

  it("throws when the loan doesn't belong to this owner", async () => {
    dbMock.loan.findFirst.mockResolvedValue(null);

    await expect(deleteLoan("loan-1")).rejects.toThrow("Loan not found");
    expect(dbMock.loan.update).not.toHaveBeenCalled();
  });

  it("refuses to delete a loan that has EMI payments on record", async () => {
    dbMock.loan.findFirst.mockResolvedValue({
      id: "loan-1",
      ownerId: "user-1",
    } as never);
    dbMock.bill.findFirst.mockResolvedValue({ id: "bill-1" } as never);

    await expect(deleteLoan("loan-1")).rejects.toThrow(
      "Cannot delete a loan that has EMI payments on record",
    );
    expect(dbMock.loan.update).not.toHaveBeenCalled();
  });

  it("soft-deletes the loan and its EMI BillSchedule, then redirects", async () => {
    dbMock.loan.findFirst.mockResolvedValue({
      id: "loan-1",
      ownerId: "user-1",
      linkedPropertyId: "prop-1",
    } as never);
    dbMock.bill.findFirst.mockResolvedValue(null);
    dbMock.loan.update.mockResolvedValue({ id: "loan-1" } as never);

    await expect(deleteLoan("loan-1")).rejects.toThrow("REDIRECT:/loans");

    expect(dbMock.loan.update).toHaveBeenCalledWith({
      where: { id: "loan-1" },
      data: { deletedAt: expect.any(Date) },
    });
    expect(dbMock.billSchedule.updateMany).toHaveBeenCalledWith({
      where: { category: "EMI", loanId: "loan-1" },
      data: { deletedAt: expect.any(Date) },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/loans");
    expect(revalidatePath).toHaveBeenCalledWith("/properties/prop-1");
  });
});
