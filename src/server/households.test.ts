import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../generated/prisma";
import { db } from "~/server/db";
import { ensureHousehold } from "./households";

jest.mock("~/server/db");
jest.mock("~/server/better-auth/server", () => ({ getSession: jest.fn() }));
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;
const USER = { id: "user-1", name: "Ananya" };

beforeEach(() => {
  mockReset(dbMock);
});

const BACKFILLED = [
  "property",
  "policy",
  "investment",
  "loan",
  "billSchedule",
  "bill",
  "document",
  "paymentTransaction",
] as const;

describe("ensureHousehold", () => {
  it("returns the household the user already belongs to", async () => {
    dbMock.householdMember.findFirst.mockResolvedValue({
      householdId: "hh-1",
    } as never);

    await expect(ensureHousehold(USER)).resolves.toBe("hh-1");
    expect(dbMock.household.create).not.toHaveBeenCalled();
  });

  it("creates a personal household with the user as owner", async () => {
    dbMock.householdMember.findFirst.mockResolvedValue(null);
    dbMock.household.create.mockResolvedValue({ id: "hh-new" } as never);

    await expect(ensureHousehold(USER)).resolves.toBe("hh-new");
    expect(dbMock.household.create).toHaveBeenCalledWith({
      data: {
        name: "Ananya's household",
        personalForUserId: "user-1",
        members: { create: { userId: "user-1", role: "OWNER" } },
      },
    });
  });

  it("moves the user's older records into the new household", async () => {
    dbMock.householdMember.findFirst.mockResolvedValue(null);
    dbMock.household.create.mockResolvedValue({ id: "hh-new" } as never);

    await ensureHousehold(USER);

    for (const model of BACKFILLED) {
      expect(dbMock[model].updateMany).toHaveBeenCalledWith({
        where: {
          ownerId: "user-1",
          OR: [{ householdId: null }, { householdId: { isSet: false } }],
        },
        data: { householdId: "hh-new" },
      });
    }
  });

  it("uses the household another request created first", async () => {
    dbMock.householdMember.findFirst.mockResolvedValue(null);
    dbMock.household.create.mockRejectedValue({ code: "P2002" });
    dbMock.household.findUnique.mockResolvedValue({ id: "hh-race" } as never);

    await expect(ensureHousehold(USER)).resolves.toBe("hh-race");
    expect(dbMock.household.findUnique).toHaveBeenCalledWith({
      where: { personalForUserId: "user-1" },
      select: { id: true },
    });
  });

  it("rethrows other errors", async () => {
    dbMock.householdMember.findFirst.mockResolvedValue(null);
    dbMock.household.create.mockRejectedValue(new Error("db down"));

    await expect(ensureHousehold(USER)).rejects.toThrow("db down");
  });
});
