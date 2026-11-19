import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { getSession } from "~/server/better-auth/server";
import { createPolicy, deletePolicy, updatePolicy } from "./policies";

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
  dbMock.policy.create.mockImplementation((async ({ data }: never) => ({
    id: "policy-1",
    status: "ACTIVE",
    ...(data as object),
  })) as never);
  // Interactive transactions run their callback against the same mock.
  dbMock.$transaction.mockImplementation(
    async (fn: (tx: typeof dbMock) => Promise<unknown>) => fn(dbMock),
  );
  getSessionMock.mockReset().mockResolvedValue(SESSION);
  redirect.mockClear();
  revalidatePath.mockClear();
});

function buildPolicyForm(overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    type: "TERM_LIFE",
    insurer: "LIC",
    policyNumber: "LIC-12345",
    holderName: "Jane Doe",
    startDate: "2022-01-10",
    nominees: "John Doe, Jack Doe",
    tenureYears: "20",
    sumAssured: "5000000",
    roomRentLimit: "5000",
    coPayPercent: "10",
    waitingPeriodMonths: "24",
    ...overrides,
  };

  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return formData;
}

describe("createPolicy", () => {
  it("redirects to / when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(createPolicy(buildPolicyForm())).rejects.toThrow("REDIRECT:/");
  });

  it("rejects a missing insurer", async () => {
    await expect(
      createPolicy(buildPolicyForm({ insurer: "  " })),
    ).rejects.toThrow("Enter the insurer");
    expect(dbMock.policy.create).not.toHaveBeenCalled();
  });

  it("rejects a missing policy number", async () => {
    await expect(
      createPolicy(buildPolicyForm({ policyNumber: "" })),
    ).rejects.toThrow("Enter the policy number");
    expect(dbMock.policy.create).not.toHaveBeenCalled();
  });

  it("rejects a missing holder name", async () => {
    await expect(
      createPolicy(buildPolicyForm({ holderName: "" })),
    ).rejects.toThrow("Enter the policyholder's name");
    expect(dbMock.policy.create).not.toHaveBeenCalled();
  });

  it("rejects an unparseable start date", async () => {
    await expect(
      createPolicy(buildPolicyForm({ startDate: "" })),
    ).rejects.toThrow("Enter a valid start date");
    expect(dbMock.policy.create).not.toHaveBeenCalled();
  });

  it("rejects a non-positive tenure", async () => {
    await expect(
      createPolicy(buildPolicyForm({ tenureYears: "0" })),
    ).rejects.toThrow("Enter a valid tenure in years");
    expect(dbMock.policy.create).not.toHaveBeenCalled();
  });

  it("splits the comma-separated nominees field into a trimmed list", async () => {
    dbMock.policy.create.mockResolvedValue({ id: "policy-1" } as never);

    await expect(createPolicy(buildPolicyForm())).rejects.toThrow("REDIRECT:");

    expect(dbMock.policy.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nominees: ["John Doe", "Jack Doe"],
      }),
    });
  });

  it("creates the policy scoped to the signed-in owner, then redirects", async () => {
    dbMock.policy.create.mockResolvedValue({ id: "policy-1" } as never);

    await expect(createPolicy(buildPolicyForm())).rejects.toThrow(
      "REDIRECT:/insurance",
    );

    expect(dbMock.policy.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: "user-1",
        householdId: "household-1",
        type: "TERM_LIFE",
        insurer: "LIC",
        policyNumber: "LIC-12345",
        holderName: "Jane Doe",
        sumAssured: 500000000,
      }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/insurance");
  });

  it("treats optional fields left blank as null/empty, not zero", async () => {
    dbMock.policy.create.mockResolvedValue({ id: "policy-1" } as never);

    await expect(
      createPolicy(
        buildPolicyForm({
          nominees: "",
          tenureYears: "",
          sumAssured: "",
          roomRentLimit: "",
          coPayPercent: "",
          waitingPeriodMonths: "",
        }),
      ),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.policy.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nominees: [],
        tenureYears: null,
        sumAssured: null,
        roomRentLimit: null,
        coPayPercent: null,
        waitingPeriodMonths: null,
      }),
    });
  });
});

describe("policy validation", () => {
  it.each(["-1", "101"])("rejects a co-pay of %s%%", async (coPay) => {
    await expect(
      createPolicy(buildPolicyForm({ coPayPercent: coPay })),
    ).rejects.toThrow("Enter a co-pay percent from 0 to 100");
    expect(dbMock.policy.create).not.toHaveBeenCalled();
  });
});

describe("policy premiums and payouts", () => {
  it("creates a premium schedule until the policy's term ends", async () => {
    await expect(
      createPolicy(
        buildPolicyForm({
          premiumAmount: "24000",
          premiumFrequency: "YEARLY",
          premiumDueDate: "2026-01-10",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/insurance");

    expect(dbMock.billSchedule.create).toHaveBeenCalledWith({
      data: {
        ownerId: "user-1",
        householdId: "household-1",
        policyId: "policy-1",
        category: "PREMIUM",
        recurrence: "YEARLY",
        startDate: new Date("2026-01-10"),
        nextDueDate: new Date("2026-01-10"),
        dueDay: 10,
        dueMonth: 1,
        // A 20-year policy from 10 Jan 2022.
        endDate: new Date("2042-01-09"),
        tenureMonths: null,
        defaultAmount: 2400000,
        active: true,
      },
    });
    // The premium fields aren't Policy columns.
    expect(dbMock.policy.create).toHaveBeenCalledWith({
      data: expect.not.objectContaining({ premiumAmount: expect.anything() }),
    });
  });

  it("creates a one-off payout", async () => {
    await expect(
      createPolicy(
        buildPolicyForm({ payoutAmount: "1000000", payoutDate: "2042-01-10" }),
      ),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.billSchedule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        category: "PAYOUT",
        startDate: new Date("2042-01-10"),
        recurrence: "YEARLY",
        tenureMonths: 12,
        defaultAmount: 100000000,
      }),
    });
  });

  it.each([
    [{ premiumAmount: "24000" }, "or leave all three blank"],
    [
      { premiumFrequency: "YEARLY", premiumDueDate: "2026-01-10" },
      "or leave all three blank",
    ],
    [{ payoutDate: "2042-01-10" }, "Enter both the payout amount"],
  ])("rejects a half-filled group %p", async (fields, message) => {
    await expect(createPolicy(buildPolicyForm(fields))).rejects.toThrow(
      message,
    );
    expect(dbMock.policy.create).not.toHaveBeenCalled();
  });

  it("stops premiums once the policy isn't active", async () => {
    dbMock.policy.findFirst.mockResolvedValue({
      id: "policy-1",
      ownerId: "user-1",
    } as never);
    dbMock.billSchedule.findMany.mockResolvedValue([
      { id: "sched-1" },
    ] as never);

    await expect(
      updatePolicy(
        "policy-1",
        buildPolicyForm({
          status: "LAPSED",
          premiumAmount: "24000",
          premiumFrequency: "YEARLY",
          premiumDueDate: "2026-01-10",
        }),
      ),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.billSchedule.create).not.toHaveBeenCalled();
    expect(dbMock.billSchedule.findMany).toHaveBeenCalledWith({
      where: { policyId: "policy-1", category: "PREMIUM" },
      select: { id: true },
    });
    expect(dbMock.billSchedule.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["sched-1"] } },
      data: { active: false },
    });
  });
});

describe("updatePolicy", () => {
  it("redirects to / when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(updatePolicy("policy-1", buildPolicyForm())).rejects.toThrow(
      "REDIRECT:/",
    );
  });

  it("throws when the policy doesn't belong to this owner", async () => {
    dbMock.policy.findFirst.mockResolvedValue(null);

    await expect(updatePolicy("policy-1", buildPolicyForm())).rejects.toThrow(
      "Policy not found",
    );
    expect(dbMock.policy.update).not.toHaveBeenCalled();
  });

  it("updates every editable field including status, then redirects", async () => {
    dbMock.policy.findFirst.mockResolvedValue({
      id: "policy-1",
      ownerId: "user-1",
    } as never);
    dbMock.policy.update.mockResolvedValue({ id: "policy-1" } as never);

    await expect(
      updatePolicy(
        "policy-1",
        buildPolicyForm({ status: "LAPSED", insurer: "HDFC Ergo" }),
      ),
    ).rejects.toThrow("REDIRECT:/insurance");

    expect(dbMock.policy.update).toHaveBeenCalledWith({
      where: { id: "policy-1" },
      data: expect.objectContaining({
        insurer: "HDFC Ergo",
        status: "LAPSED",
      }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/insurance");
  });
});

describe("deletePolicy", () => {
  it("redirects to / when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(deletePolicy("policy-1")).rejects.toThrow("REDIRECT:/");
  });

  it("throws when the policy doesn't belong to this owner", async () => {
    dbMock.policy.findFirst.mockResolvedValue(null);

    await expect(deletePolicy("policy-1")).rejects.toThrow("Policy not found");
    expect(dbMock.policy.update).not.toHaveBeenCalled();
  });

  it("refuses to delete a policy that has premiums or payouts on record", async () => {
    dbMock.policy.findFirst.mockResolvedValue({
      id: "policy-1",
      ownerId: "user-1",
    } as never);
    dbMock.bill.findFirst.mockResolvedValue({ id: "bill-1" } as never);

    await expect(deletePolicy("policy-1")).rejects.toThrow(
      "Cannot delete a policy that has premiums or payouts on record",
    );
    expect(dbMock.policy.update).not.toHaveBeenCalled();
  });

  it("soft-deletes the policy, then redirects", async () => {
    dbMock.policy.findFirst.mockResolvedValue({
      id: "policy-1",
      ownerId: "user-1",
    } as never);
    dbMock.bill.findFirst.mockResolvedValue(null);
    dbMock.policy.update.mockResolvedValue({ id: "policy-1" } as never);

    await expect(deletePolicy("policy-1")).rejects.toThrow(
      "REDIRECT:/insurance",
    );

    expect(dbMock.policy.update).toHaveBeenCalledWith({
      where: { id: "policy-1" },
      data: { deletedAt: expect.any(Date) },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/insurance");
  });
});
