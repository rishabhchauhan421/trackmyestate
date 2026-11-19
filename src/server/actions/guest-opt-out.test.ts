import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { signGuestOptOut, signRecipientOptOut } from "~/server/guests/opt-out";
import { stopReminders } from "./guest-opt-out";

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

describe("stopReminders", () => {
  beforeEach(() => {
    dbMock.guest.findUnique.mockResolvedValue({
      email: "Radha@Example.com",
      ownerId: "owner-1",
    } as never);
  });

  it("opts the guest out and suppresses their address for that owner", async () => {
    const sig = signGuestOptOut("guest-1");

    await expect(
      stopReminders({ guest: "guest-1", sig }, false),
    ).rejects.toThrow("REDIRECT:/reminders/stop?guest=guest-1");
    expect(dbMock.guest.updateMany).toHaveBeenCalledWith({
      where: {
        id: "guest-1",
        OR: [{ optedOutAt: null }, { optedOutAt: { isSet: false } }],
      },
      data: { optedOutAt: expect.any(Date) as Date },
    });
    expect(dbMock.emailSuppression.upsert).toHaveBeenCalledTimes(1);
    expect(dbMock.emailSuppression.upsert).toHaveBeenCalledWith({
      where: { key: "owner-1:radha@example.com" },
      create: {
        key: "owner-1:radha@example.com",
        email: "radha@example.com",
        ownerId: "owner-1",
        reason: "GUEST_OPT_OUT",
      },
      update: {},
    });
  });

  it("suppresses the address for everyone when asked", async () => {
    await expect(
      stopReminders(
        { guest: "guest-1", sig: signGuestOptOut("guest-1") },
        true,
      ),
    ).rejects.toThrow("done=all");
    expect(dbMock.emailSuppression.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "*:radha@example.com" },
      }),
    );
  });

  it("unsubscribes a utility recipient by signed address", async () => {
    const sig = signRecipientOptOut("owner-1", "asha@example.com");

    await expect(
      stopReminders(
        { owner: "owner-1", email: "asha@example.com", sig },
        false,
      ),
    ).rejects.toThrow("REDIRECT:/reminders/stop?owner=owner-1");
    expect(dbMock.guest.updateMany).not.toHaveBeenCalled();
    expect(dbMock.emailSuppression.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "owner-1:asha@example.com" },
        create: expect.objectContaining({
          reason: "RECIPIENT_UNSUBSCRIBE",
        }) as object,
      }),
    );
  });

  it("refuses a forged or mismatched signature", async () => {
    await expect(
      stopReminders(
        { guest: "guest-2", sig: signGuestOptOut("guest-1") },
        false,
      ),
    ).rejects.toThrow("This link isn't valid");
    await expect(
      stopReminders(
        {
          owner: "owner-2",
          email: "asha@example.com",
          sig: signRecipientOptOut("owner-1", "asha@example.com"),
        },
        false,
      ),
    ).rejects.toThrow("This link isn't valid");
    expect(dbMock.guest.updateMany).not.toHaveBeenCalled();
    expect(dbMock.emailSuppression.upsert).not.toHaveBeenCalled();
  });
});
