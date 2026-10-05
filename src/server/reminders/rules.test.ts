import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { reminderCategoryConfig } from "~/lib/reminders";
import { db } from "~/server/db";
import {
  getEffectiveRemindersForOwners,
  getReminderSettings,
  saveCategoryReminders,
} from "./rules";

jest.mock("~/server/db");

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;

function rule(
  category: string,
  offsetDays: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    ownerId: "user-1",
    category,
    offsetDays,
    channels: ["EMAIL"],
    active: true,
    ...overrides,
  };
}

beforeEach(() => {
  mockReset(dbMock);
});

describe("getReminderSettings", () => {
  it("uses the built-in defaults for categories the user hasn't changed", async () => {
    dbMock.notificationRule.findMany.mockResolvedValue([]);

    const settings = await getReminderSettings("user-1");
    const premium = settings.find((s) => s.category === "PREMIUM")!;

    expect(premium).toEqual({
      category: "PREMIUM",
      offsets: reminderCategoryConfig("PREMIUM").defaultOffsets,
      channels: ["EMAIL"],
      customised: false,
    });
  });

  it("uses stored rules, sorted, for a customised category", async () => {
    dbMock.notificationRule.findMany.mockResolvedValue([
      rule("EMI", 0),
      rule("EMI", -7),
    ] as never);

    const settings = await getReminderSettings("user-1");

    expect(settings.find((s) => s.category === "EMI")).toMatchObject({
      offsets: [-7, 0],
      customised: true,
    });
    // Other categories are unaffected.
    expect(
      settings.find((s) => s.category === "UTILITY_BILL")?.customised,
    ).toBe(false);
  });

  it("treats a lone inactive row as 'reminders off', not defaults", async () => {
    dbMock.notificationRule.findMany.mockResolvedValue([
      rule("RENT", 0, { active: false }),
    ] as never);

    const settings = await getReminderSettings("user-1");

    expect(settings.find((s) => s.category === "RENT")).toMatchObject({
      offsets: [],
      customised: true,
    });
  });
});

describe("getEffectiveRemindersForOwners", () => {
  it("resolves each owner's own rules, falling back to defaults", async () => {
    dbMock.notificationRule.findMany.mockResolvedValue([
      rule("EMI", -1, { ownerId: "user-1" }),
    ] as never);

    const remindersFor = await getEffectiveRemindersForOwners([
      "user-1",
      "user-2",
    ]);

    expect(remindersFor("user-1", "EMI")).toEqual([
      { offsetDays: -1, channels: ["EMAIL"] },
    ]);
    expect(remindersFor("user-2", "EMI").map((r) => r.offsetDays)).toEqual(
      reminderCategoryConfig("EMI").defaultOffsets,
    );
  });

  it("skips the query when there are no owners", async () => {
    await getEffectiveRemindersForOwners([]);
    expect(dbMock.notificationRule.findMany).not.toHaveBeenCalled();
  });
});

describe("saveCategoryReminders", () => {
  it("stores a custom schedule as one rule per offset", async () => {
    await saveCategoryReminders("user-1", "EMI", [0, -7, -7], ["EMAIL"]);

    expect(dbMock.notificationRule.deleteMany).toHaveBeenCalled();
    expect(dbMock.notificationRule.createMany).toHaveBeenCalledWith({
      data: [
        {
          ownerId: "user-1",
          category: "EMI",
          anchor: "DUE_DATE",
          offsetDays: -7,
          channels: ["EMAIL"],
        },
        {
          ownerId: "user-1",
          category: "EMI",
          anchor: "DUE_DATE",
          offsetDays: 0,
          channels: ["EMAIL"],
        },
      ],
    });
  });

  it("stores nothing when the choice equals the defaults", async () => {
    await saveCategoryReminders(
      "user-1",
      "EMI",
      reminderCategoryConfig("EMI").defaultOffsets,
      ["EMAIL"],
    );

    expect(dbMock.notificationRule.deleteMany).toHaveBeenCalled();
    expect(dbMock.notificationRule.createMany).not.toHaveBeenCalled();
    expect(dbMock.notificationRule.create).not.toHaveBeenCalled();
  });

  it("stores an inactive marker when every reminder is turned off", async () => {
    await saveCategoryReminders("user-1", "RENT", [], ["EMAIL"]);

    expect(dbMock.notificationRule.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: "user-1",
        category: "RENT",
        active: false,
      }),
    });
    expect(dbMock.notificationRule.createMany).not.toHaveBeenCalled();
  });
});
