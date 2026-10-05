import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { signGuestOptOut } from "~/server/guests/opt-out";
import { stopGuestReminders } from "./guest-opt-out";

jest.mock("~/server/db");
jest.mock("~/env", () => ({
  env: {
    BETTER_AUTH_SECRET: "test-secret",
    NEXT_PUBLIC_SITE_URL: "https://trackmyestate.app",
  },
}));
jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(dbMock);
});

describe("stopGuestReminders", () => {
  it("opts the guest out with a valid signed link", async () => {
    const sig = signGuestOptOut("guest-1");

    await expect(stopGuestReminders("guest-1", sig)).rejects.toThrow(
      "REDIRECT:/reminders/stop?guest=guest-1",
    );
    expect(dbMock.guest.updateMany).toHaveBeenCalledWith({
      where: {
        id: "guest-1",
        OR: [{ optedOutAt: null }, { optedOutAt: { isSet: false } }],
      },
      data: { optedOutAt: expect.any(Date) as Date },
    });
  });

  it("refuses a forged or mismatched signature", async () => {
    await expect(
      stopGuestReminders("guest-2", signGuestOptOut("guest-1")),
    ).rejects.toThrow("This link isn't valid");
    expect(dbMock.guest.updateMany).not.toHaveBeenCalled();
  });
});
