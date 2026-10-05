import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { saveCategoryReminders } from "~/server/reminders/rules";
import {
  resetCategoryReminders,
  updateReminderSettings,
  updateTimeZone,
} from "./settings";

jest.mock("~/server/db");
jest.mock("~/server/reminders/rules", () => ({
  saveCategoryReminders: jest.fn(),
}));
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

function form(timezone?: string) {
  const formData = new FormData();
  if (timezone !== undefined) formData.set("timezone", timezone);
  return formData;
}

const saveMock = saveCategoryReminders as jest.Mock;

beforeEach(() => {
  mockReset(dbMock);
  saveMock.mockReset();
  getSessionMock.mockReset().mockResolvedValue({ user: { id: "user-1" } });
});

describe("updateTimeZone", () => {
  it("saves a valid zone for the signed-in user", async () => {
    await expect(updateTimeZone(form("Europe/London"))).rejects.toThrow(
      "REDIRECT:/settings?saved=timezone",
    );

    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { timezone: "Europe/London" },
    });
  });

  it("stores the current name for a legacy alias", async () => {
    await expect(updateTimeZone(form("Asia/Calcutta"))).rejects.toThrow(
      "REDIRECT:",
    );

    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { timezone: "Asia/Kolkata" },
    });
  });

  it.each([
    ["missing", undefined, "Choose a time zone"],
    ["unknown", "Mars/Olympus_Mons", "Choose a valid time zone"],
  ])("rejects a %s zone", async (_, zone, message) => {
    await expect(updateTimeZone(form(zone))).rejects.toThrow(message);
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });

  it("redirects to sign in without a session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(updateTimeZone(form("UTC"))).rejects.toThrow(
      "REDIRECT:/login",
    );
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });
});

describe("updateReminderSettings", () => {
  function remindersForm(choices: Record<string, string[]>) {
    const formData = new FormData();
    for (const [category, offsets] of Object.entries(choices)) {
      for (const offset of offsets)
        formData.append(`offsets.${category}`, offset);
    }
    return formData;
  }

  it("saves every category, with unchecked ones turned off", async () => {
    await expect(
      updateReminderSettings(
        remindersForm({ EMI: ["-7", "0"], PREMIUM: ["-30", "-1"] }),
      ),
    ).rejects.toThrow("REDIRECT:/settings?saved=reminders");

    expect(saveMock).toHaveBeenCalledWith("user-1", "EMI", [-7, 0], ["EMAIL"]);
    expect(saveMock).toHaveBeenCalledWith(
      "user-1",
      "PREMIUM",
      [-30, -1],
      ["EMAIL"],
    );
    expect(saveMock).toHaveBeenCalledWith("user-1", "RENT", [], ["EMAIL"]);
  });

  it("rejects an offset that isn't one of the presets", async () => {
    await expect(
      updateReminderSettings(remindersForm({ EMI: ["-2"] })),
    ).rejects.toThrow("Choose reminders from the options shown");
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("rejects more than the per-category cap", async () => {
    await expect(
      updateReminderSettings(
        remindersForm({ EMI: ["-30", "-14", "-7", "-3", "-1", "0"] }),
      ),
    ).rejects.toThrow("Choose at most 5 reminders per kind");
    expect(saveMock).not.toHaveBeenCalled();
  });
});

describe("resetCategoryReminders", () => {
  it("puts one category back on its defaults", async () => {
    await expect(resetCategoryReminders("EMI")).rejects.toThrow(
      "REDIRECT:/settings?saved=reminders",
    );
    expect(saveMock).toHaveBeenCalledWith("user-1", "EMI", [-3, 0], ["EMAIL"]);
  });
});
