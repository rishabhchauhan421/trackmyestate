import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { sendGuestWelcomeEmail } from "~/server/guests/emails";
import {
  createGuest,
  pauseGuest,
  removeGuest,
  resumeGuest,
  updateGuest,
} from "./guests";

jest.mock("~/server/db");
jest.mock("~/server/better-auth/server", () => ({ getSession: jest.fn() }));
jest.mock("~/server/guests/emails", () => ({
  sendGuestWelcomeEmail: jest.fn(),
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;
const getSessionMock = getSession as jest.Mock;
const welcomeMock = sendGuestWelcomeEmail as jest.Mock;

function guestForm(fields: Record<string, string | string[]> = {}): FormData {
  const all: Record<string, string | string[]> = {
    name: "Radha Rao",
    relationship: "Family",
    email: "radha@example.com",
    mobile: "",
    channels: ["EMAIL"],
    categories: ["UTILITY_BILL"],
    propertyScope: "all",
    when: "schedule",
    ...fields,
  };
  const formData = new FormData();
  for (const [key, value] of Object.entries(all)) {
    for (const v of Array.isArray(value) ? value : [value]) {
      formData.append(key, v);
    }
  }
  return formData;
}

beforeEach(() => {
  mockReset(dbMock);
  welcomeMock.mockReset();
  getSessionMock
    .mockReset()
    .mockResolvedValue({ user: { id: "user-1", name: "Ananya Rao" } });
  dbMock.guest.create.mockImplementation((async ({ data }: never) => ({
    id: "guest-1",
    ...(data as object),
  })) as never);
});

describe("createGuest", () => {
  it("saves the guest and emails them once", async () => {
    await expect(createGuest(guestForm())).rejects.toThrow(
      "REDIRECT:/settings/guests?saved=added",
    );

    expect(dbMock.guest.create).toHaveBeenCalledWith({
      data: {
        ownerId: "user-1",
        name: "Radha Rao",
        relationship: "Family",
        email: "radha@example.com",
        phone: null,
        channels: ["EMAIL"],
        categories: ["UTILITY_BILL"],
        propertyIds: [],
        dueDayOnly: false,
      },
    });
    expect(welcomeMock).toHaveBeenCalledWith({
      guestId: "guest-1",
      to: "radha@example.com",
      guestName: "Radha Rao",
      ownerName: "Ananya Rao",
      categories: ["UTILITY_BILL"],
    });
  });

  it("normalises the mobile number and skips the email for a phone-only guest", async () => {
    await expect(
      createGuest(
        guestForm({
          email: "",
          mobile: "99001 23456",
          channels: ["WHATSAPP"],
          categories: ["RENT"],
          when: "dueDay",
        }),
      ),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.guest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: null,
        phone: "+919900123456",
        channels: ["WHATSAPP"],
        dueDayOnly: true,
      }),
    });
    expect(welcomeMock).not.toHaveBeenCalled();
  });

  it("limits to the owner's chosen properties", async () => {
    dbMock.property.findMany.mockResolvedValue([{ id: "prop-1" }] as never);

    await expect(
      createGuest(
        guestForm({ propertyScope: "some", propertyIds: ["prop-1"] }),
      ),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.property.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ownerId: "user-1" }),
      }),
    );
    expect(dbMock.guest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ propertyIds: ["prop-1"] }),
    });
  });

  it("refuses someone else's property", async () => {
    dbMock.property.findMany.mockResolvedValue([] as never);

    await expect(
      createGuest(
        guestForm({ propertyScope: "some", propertyIds: ["theirs"] }),
      ),
    ).rejects.toThrow("Property not found");
    expect(dbMock.guest.create).not.toHaveBeenCalled();
  });

  it.each([
    [{ name: "" }, "Enter the guest's name"],
    [{ email: "", mobile: "" }, "Add an email or a mobile number"],
    [{ email: "not-an-email" }, "Enter a valid email"],
    [{ mobile: "12345" }, "Enter a valid 10-digit mobile number"],
    [{ channels: [] }, "Choose at least one way to send reminders"],
    [{ categories: [] }, "Choose at least one kind of payment"],
    [{ channels: ["SMS"] }, "Add a mobile number to send by SMS or WhatsApp"],
    [
      { email: "", mobile: "9876543210", channels: ["EMAIL"] },
      "Add an email to send by email",
    ],
    [{ propertyScope: "some" }, "Choose at least one property"],
  ])("rejects %p", async (fields, message) => {
    await expect(createGuest(guestForm(fields))).rejects.toThrow(message);
    expect(dbMock.guest.create).not.toHaveBeenCalled();
  });
});

describe("updating a guest", () => {
  it("updates only the owner's own guest", async () => {
    dbMock.guest.findFirst.mockResolvedValue({ id: "guest-1" } as never);

    await expect(
      updateGuest("guest-1", guestForm({ when: "dueDay" })),
    ).rejects.toThrow("REDIRECT:/settings/guests?saved=updated");

    expect(dbMock.guest.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "guest-1", ownerId: "user-1" }),
    });
    expect(dbMock.guest.update).toHaveBeenCalledWith({
      where: { id: "guest-1" },
      data: expect.objectContaining({ dueDayOnly: true }),
    });
  });

  it("refuses a guest that isn't the owner's", async () => {
    dbMock.guest.findFirst.mockResolvedValue(null);

    await expect(updateGuest("guest-x", guestForm())).rejects.toThrow(
      "Guest not found",
    );
    await expect(pauseGuest("guest-x")).rejects.toThrow("Guest not found");
    await expect(removeGuest("guest-x")).rejects.toThrow("Guest not found");
    expect(dbMock.guest.update).not.toHaveBeenCalled();
  });

  it("pauses, resumes and soft-deletes", async () => {
    dbMock.guest.findFirst.mockResolvedValue({
      id: "guest-1",
      optedOutAt: null,
    } as never);

    await pauseGuest("guest-1");
    await resumeGuest("guest-1");
    await removeGuest("guest-1");

    const updates = dbMock.guest.update.mock.calls.map(([arg]) => arg.data);
    expect(updates[0]).toEqual({ pausedAt: expect.any(Date) });
    expect(updates[1]).toEqual({ pausedAt: null });
    expect(updates[2]).toEqual({ deletedAt: expect.any(Date) });
  });

  it("won't resume a guest who stopped reminders themselves", async () => {
    dbMock.guest.findFirst.mockResolvedValue({
      id: "guest-1",
      optedOutAt: new Date(),
    } as never);

    await expect(resumeGuest("guest-1")).rejects.toThrow(
      "This guest stopped reminders themselves",
    );
    expect(dbMock.guest.update).not.toHaveBeenCalled();
  });
});
