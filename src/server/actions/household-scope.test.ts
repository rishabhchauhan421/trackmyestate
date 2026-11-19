/**
 * Every mutation looks its record up inside the signed-in user's household
 * (never by user id alone, never across households), so a portfolio can be
 * shared and nobody can touch another household's data by id.
 */
import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { HOUSEHOLD_ID } from "~/server/__testing__/households-mock";
import { recordBillPayment } from "./bills";
import { updateInvestment } from "./investments";
import { createLease, updateLease } from "./leases";
import { updateLoan } from "./loans";
import { updatePolicy } from "./policies";
import { updateProperty } from "./properties";
import { createRental } from "./rentals";
import { deactivateUtility } from "./utilities";

jest.mock("~/server/db");
jest.mock("~/server/households", () =>
  jest.requireActual<Record<string, unknown>>(
    "~/server/__testing__/households-mock",
  ),
);
jest.mock("~/server/better-auth/server", () => ({
  getSession: jest.fn(async () => ({ user: { id: "user-1" } })),
}));
jest.mock("~/server/bills/generate", () => ({
  generateBillsForSchedule: jest.fn(),
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(dbMock);
});

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

const notFound = "not found";

describe("household scoping", () => {
  it.each([
    ["updateProperty", () => updateProperty("p1", form({})), "property"],
    ["updatePolicy", () => updatePolicy("x1", form({})), "policy"],
    ["updateInvestment", () => updateInvestment("x1", form({})), "investment"],
    ["updateLoan", () => updateLoan("x1", form({})), "loan"],
    ["deactivateUtility", () => deactivateUtility("x1"), "billSchedule"],
    ["recordBillPayment", () => recordBillPayment("x1", form({})), "bill"],
  ] as const)(
    "%s looks the record up in the household",
    async (_name, run, model) => {
      await expect(run()).rejects.toThrow(new RegExp(notFound, "i"));
      const findFirst = dbMock[model].findFirst as jest.Mock;
      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ householdId: HOUSEHOLD_ID }),
        }),
      );
    },
  );

  it("updateLease checks the lease's property is in the household", async () => {
    await expect(updateLease("l1", form({}))).rejects.toThrow(/not found/i);
    expect(dbMock.lease.findFirst).toHaveBeenCalledWith({
      where: { id: "l1", property: { householdId: HOUSEHOLD_ID } },
    });
  });

  it.each([
    [
      "createLease",
      () =>
        createLease(
          form({
            propertyId: "p1",
            tenantName: "T",
            tenantPhone: "9876543210",
            leaseStart: "2026-01-01",
            rentAmount: "100",
            depositAmount: "0",
            rentDueDay: "5",
          }),
        ),
    ],
    [
      "createRental",
      () => createRental(form({ propertyId: "p1", label: "A" })),
    ],
  ] as const)("%s checks the property is in the household", async (_n, run) => {
    await expect(run()).rejects.toThrow(/not found/i);
    expect(dbMock.property.findFirst).toHaveBeenCalledWith({
      where: { id: "p1", householdId: HOUSEHOLD_ID },
    });
  });
});
