import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { saveCategoryReminders } from "~/server/reminders/rules";
import { sendTransactionalEmail } from "~/server/email/send";
import {
  resetCategoryReminders,
  sendTestEmail,
  updateChannelSettings,
  updateGeneralSettings,
  updateReminderSettings,
} from "./settings";

jest.mock("~/server/db");
jest.mock("~/server/reminders/rules", () => ({
  saveCategoryReminders: jest.fn(),
}));
jest.mock("~/server/email/send", () => ({
  sendTransactionalEmail: jest.fn(),
  renderTransactionalEmail: () => ({ html: "<p>test</p>", text: "test" }),
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

function form(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

const saveMock = saveCategoryReminders as jest.Mock;
const sendMock = sendTransactionalEmail as jest.Mock;

beforeEach(() => {
  mockReset(dbMock);
  saveMock.mockReset();
  sendMock.mockReset().mockResolvedValue(true);
  getSessionMock
    .mockReset()
    .mockResolvedValue({ user: { id: "user-1", email: "me@example.com" } });
});

describe("updateGeneralSettings", () => {
  const valid = {
    name: " Ananya Rao ",
    timezone: "Asia/Calcutta",
    currency: "INR",
  };

  it("saves name, time zone (normalised) and currency", async () => {
    await expect(updateGeneralSettings(form(valid))).rejects.toThrow(
      "REDIRECT:/settings?saved=general",
    );
    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { name: "Ananya Rao", timezone: "Asia/Kolkata", currency: "INR" },
    });
  });

  it.each([
    [{ name: "" }, "Enter your name"],
    [{ timezone: "Mars/Olympus_Mons" }, "Choose a valid time zone"],
    [{ currency: "XYZ" }, "Choose a currency"],
  ])("rejects %p", async (override, message) => {
    await expect(
      updateGeneralSettings(form({ ...valid, ...override })),
    ).rejects.toThrow(message);
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });

  it("redirects to sign in without a session", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(updateGeneralSettings(form(valid))).rejects.toThrow(
      "REDIRECT:/login",
    );
  });
});

describe("updateChannelSettings", () => {
  it("saves a normalised mobile number and the send hour", async () => {
    await expect(
      updateChannelSettings(
        form({ mobile: "98765 43210", reminderHour: "18" }),
      ),
    ).rejects.toThrow("REDIRECT:/settings/channels?saved=channels");
    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { phone: "+919876543210", reminderHour: 18 },
    });
  });

  it("clears the mobile number when left blank", async () => {
    await expect(
      updateChannelSettings(form({ mobile: "", reminderHour: "9" })),
    ).rejects.toThrow("REDIRECT:");
    expect(dbMock.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { phone: null, reminderHour: 9 },
    });
  });

  it.each([
    [
      { mobile: "12345", reminderHour: "9" },
      "Enter a valid 10-digit mobile number",
    ],
    [{ mobile: "", reminderHour: "3" }, "Choose a time for reminders"],
  ])("rejects %p", async (fields, message) => {
    await expect(updateChannelSettings(form(fields))).rejects.toThrow(message);
    expect(dbMock.user.update).not.toHaveBeenCalled();
  });
});

describe("sendTestEmail", () => {
  it("emails the signed-in user", async () => {
    await expect(sendTestEmail()).rejects.toThrow(
      "REDIRECT:/settings/channels?saved=test",
    );
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "me@example.com" }),
    );
  });

  it("says so when sending failed", async () => {
    sendMock.mockResolvedValue(false);
    await expect(sendTestEmail()).rejects.toThrow(
      "REDIRECT:/settings/channels?saved=test-failed",
    );
  });
});

describe("updateReminderSettings", () => {
  function remindersForm(choices: Record<string, string[]>) {
    const formData = new FormData();
    for (const [category, offsets] of Object.entries(choices)) {
      for (const offset of offsets)
        formData.append(`offsets.${category}`, offset);
      formData.append(`channels.${category}`, "EMAIL");
    }
    return formData;
  }

  it("saves every category, with unchecked ones turned off", async () => {
    await expect(
      updateReminderSettings(
        remindersForm({ EMI: ["-7", "0"], PREMIUM: ["-30", "-1"] }),
      ),
    ).rejects.toThrow("REDIRECT:/settings/reminders?saved=reminders");

    expect(saveMock).toHaveBeenCalledWith("user-1", "EMI", [-7, 0], ["EMAIL"]);
    expect(saveMock).toHaveBeenCalledWith(
      "user-1",
      "PREMIUM",
      [-30, -1],
      ["EMAIL"],
    );
    expect(saveMock).toHaveBeenCalledWith("user-1", "RENT", [], ["EMAIL"]);
  });

  it("rejects a channel that can't deliver yet", async () => {
    const formData = remindersForm({ EMI: ["0"] });
    formData.append("channels.EMI", "WHATSAPP");
    await expect(updateReminderSettings(formData)).rejects.toThrow(
      "That channel isn't available yet",
    );
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("needs a channel for a kind that has reminders", async () => {
    const formData = new FormData();
    formData.append("offsets.EMI", "0");
    await expect(updateReminderSettings(formData)).rejects.toThrow(
      "Choose at least one channel",
    );
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
      "REDIRECT:/settings/reminders?saved=reminders",
    );
    expect(saveMock).toHaveBeenCalledWith("user-1", "EMI", [-3, 0], ["EMAIL"]);
  });
});
