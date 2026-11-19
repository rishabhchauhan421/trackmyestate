import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { getSession } from "~/server/better-auth/server";
import {
  createInvestment,
  deleteInvestment,
  updateInvestment,
} from "./investments";

jest.mock("~/server/db");
jest.mock("~/server/households", () =>
  jest.requireActual<Record<string, unknown>>(
    "~/server/__testing__/households-mock",
  ),
);
jest.mock("~/server/better-auth/server", () => ({
  getSession: jest.fn(),
}));
jest.mock("~/server/bills/generate", () => ({
  generateBillsForSchedule: jest.fn(),
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
const { redirect } = jest.requireMock<{
  redirect: jest.Mock;
}>("next/navigation");
const { revalidatePath } = jest.requireMock<{
  revalidatePath: jest.Mock;
}>("next/cache");

const SESSION = { user: { id: "user-1", email: "owner@example.com" } };

beforeEach(() => {
  mockReset(dbMock);
  dbMock.billSchedule.findMany.mockResolvedValue([]);
  dbMock.billSchedule.create.mockResolvedValue({ id: "sched-1" } as never);
  dbMock.bill.findMany.mockResolvedValue([]);
  dbMock.investment.create.mockResolvedValue({
    id: "inv-1",
    ownerId: "user-1",
  } as never);
  // Interactive transactions run their callback against the same mock.
  dbMock.$transaction.mockImplementation(
    async (fn: (tx: typeof dbMock) => Promise<unknown>) => fn(dbMock),
  );
  getSessionMock.mockReset().mockResolvedValue(SESSION);
  redirect.mockClear();
  revalidatePath.mockClear();
});

function buildInvestmentForm(overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    name: "HDFC Flexicap Fund",
    type: "MUTUAL_FUND",
    institution: "HDFC Mutual Fund",
    investedDate: "2025-01-10",
    capitalDeployed: "50000",
    expectedReturnType: "Growth",
    expectedReturnDate: "2030-01-10",
    targetRoiPercent: "12",
    currentEstimatedValue: "55000",
    ...overrides,
  };

  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return formData;
}

describe("createInvestment", () => {
  it("redirects to / when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(createInvestment(buildInvestmentForm())).rejects.toThrow(
      "REDIRECT:/",
    );
  });

  it("rejects a missing name", async () => {
    await expect(
      createInvestment(buildInvestmentForm({ name: "  " })),
    ).rejects.toThrow("Enter a name");
    expect(dbMock.investment.create).not.toHaveBeenCalled();
  });

  it("rejects a non-positive capital deployed amount", async () => {
    await expect(
      createInvestment(buildInvestmentForm({ capitalDeployed: "0" })),
    ).rejects.toThrow("Enter a valid capital deployed amount");
    expect(dbMock.investment.create).not.toHaveBeenCalled();
  });

  it("rejects an unparseable invested date", async () => {
    await expect(
      createInvestment(buildInvestmentForm({ investedDate: "" })),
    ).rejects.toThrow("Enter a valid invested date");
    expect(dbMock.investment.create).not.toHaveBeenCalled();
  });

  it("rejects an unparseable expected return date", async () => {
    await expect(
      createInvestment(
        buildInvestmentForm({ expectedReturnDate: "not-a-date" }),
      ),
    ).rejects.toThrow("Enter a valid expected return date");
    expect(dbMock.investment.create).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric target ROI", async () => {
    await expect(
      createInvestment(buildInvestmentForm({ targetRoiPercent: "abc" })),
    ).rejects.toThrow("Enter a valid target ROI");
    expect(dbMock.investment.create).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric current estimated value", async () => {
    await expect(
      createInvestment(buildInvestmentForm({ currentEstimatedValue: "abc" })),
    ).rejects.toThrow("Enter a valid current estimated value");
    expect(dbMock.investment.create).not.toHaveBeenCalled();
  });

  it("creates the investment scoped to the signed-in owner, then redirects", async () => {
    dbMock.investment.create.mockResolvedValue({ id: "inv-1" } as never);

    await expect(createInvestment(buildInvestmentForm())).rejects.toThrow(
      "REDIRECT:/investments",
    );

    expect(dbMock.investment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: "user-1",
        householdId: "household-1",
        name: "HDFC Flexicap Fund",
        type: "MUTUAL_FUND",
        institution: "HDFC Mutual Fund",
        capitalDeployed: 5000000,
        targetRoiPercent: 12,
        currentEstimatedValue: 5500000,
      }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/investments");
  });

  it("treats optional fields left blank as null, not zero/empty string", async () => {
    dbMock.investment.create.mockResolvedValue({ id: "inv-1" } as never);

    await expect(
      createInvestment(
        buildInvestmentForm({
          institution: "",
          expectedReturnType: "",
          expectedReturnDate: "",
          targetRoiPercent: "",
          currentEstimatedValue: "",
        }),
      ),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.investment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        institution: null,
        expectedReturnType: null,
        expectedReturnDate: null,
        targetRoiPercent: null,
        currentEstimatedValue: null,
      }),
    });
  });
});

describe("investment returns", () => {
  it("bills the expected return once, on its date", async () => {
    await expect(createInvestment(buildInvestmentForm())).rejects.toThrow(
      "REDIRECT:/investments",
    );

    expect(dbMock.billSchedule.create).toHaveBeenCalledWith({
      data: {
        ownerId: "user-1",
        householdId: "household-1",
        investmentId: "inv-1",
        category: "INVESTMENT_RETURN",
        recurrence: "YEARLY",
        startDate: new Date("2030-01-10"),
        dueDay: 10,
        dueMonth: 1,
        endDate: null,
        tenureMonths: 12,
        // The current estimate, ₹55,000.
        defaultAmount: 5500000,
        active: true,
      },
    });
  });

  it("retires the return when the date is cleared", async () => {
    dbMock.investment.findFirst.mockResolvedValue({
      id: "inv-1",
      ownerId: "user-1",
    } as never);

    await expect(
      updateInvestment(
        "inv-1",
        buildInvestmentForm({ expectedReturnDate: "" }),
      ),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.billSchedule.create).not.toHaveBeenCalled();
    expect(dbMock.billSchedule.findMany).toHaveBeenCalledWith({
      where: { investmentId: "inv-1", category: "INVESTMENT_RETURN" },
      select: { id: true },
    });
  });
});

describe("updateInvestment", () => {
  it("redirects to / when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(
      updateInvestment("inv-1", buildInvestmentForm()),
    ).rejects.toThrow("REDIRECT:/");
  });

  it("throws when the investment doesn't belong to this owner", async () => {
    dbMock.investment.findFirst.mockResolvedValue(null);

    await expect(
      updateInvestment("inv-1", buildInvestmentForm()),
    ).rejects.toThrow("Investment not found");
    expect(dbMock.investment.update).not.toHaveBeenCalled();
  });

  it("rejects invalid fields before writing anything", async () => {
    dbMock.investment.findFirst.mockResolvedValue({
      id: "inv-1",
      ownerId: "user-1",
    } as never);

    await expect(
      updateInvestment("inv-1", buildInvestmentForm({ capitalDeployed: "-5" })),
    ).rejects.toThrow("Enter a valid capital deployed amount");
    expect(dbMock.investment.update).not.toHaveBeenCalled();
  });

  it("updates every editable field, then redirects", async () => {
    dbMock.investment.findFirst.mockResolvedValue({
      id: "inv-1",
      ownerId: "user-1",
    } as never);
    dbMock.investment.update.mockResolvedValue({ id: "inv-1" } as never);

    await expect(
      updateInvestment(
        "inv-1",
        buildInvestmentForm({ name: "Updated Fund", capitalDeployed: "60000" }),
      ),
    ).rejects.toThrow("REDIRECT:/investments");

    expect(dbMock.investment.update).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: expect.objectContaining({
        name: "Updated Fund",
        capitalDeployed: 6000000,
      }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/investments");
  });
});

describe("deleteInvestment", () => {
  it("redirects to / when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(deleteInvestment("inv-1")).rejects.toThrow("REDIRECT:/");
  });

  it("throws when the investment doesn't belong to this owner", async () => {
    dbMock.investment.findFirst.mockResolvedValue(null);

    await expect(deleteInvestment("inv-1")).rejects.toThrow(
      "Investment not found",
    );
    expect(dbMock.investment.update).not.toHaveBeenCalled();
  });

  it("refuses to delete an investment that has returns on record", async () => {
    dbMock.investment.findFirst.mockResolvedValue({
      id: "inv-1",
      ownerId: "user-1",
    } as never);
    dbMock.bill.findFirst.mockResolvedValue({ id: "bill-1" } as never);

    await expect(deleteInvestment("inv-1")).rejects.toThrow(
      "Cannot delete an investment that has returns on record",
    );
    expect(dbMock.investment.update).not.toHaveBeenCalled();
  });

  it("soft-deletes the investment, then redirects", async () => {
    dbMock.investment.findFirst.mockResolvedValue({
      id: "inv-1",
      ownerId: "user-1",
    } as never);
    dbMock.bill.findFirst.mockResolvedValue(null);
    dbMock.investment.update.mockResolvedValue({ id: "inv-1" } as never);

    await expect(deleteInvestment("inv-1")).rejects.toThrow(
      "REDIRECT:/investments",
    );

    expect(dbMock.investment.update).toHaveBeenCalledWith({
      where: { id: "inv-1" },
      data: { deletedAt: expect.any(Date) },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/investments");
  });
});
