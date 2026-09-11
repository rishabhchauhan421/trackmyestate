import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { getSession } from "~/server/better-auth/server";
import { createRental } from "./rentals";

jest.mock("~/server/db");
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
const { redirect } = jest.requireMock("next/navigation") as {
  redirect: jest.Mock;
};
const { revalidatePath } = jest.requireMock("next/cache") as {
  revalidatePath: jest.Mock;
};

const SESSION = { user: { id: "user-1", email: "owner@example.com" } };
const RENTED_PROPERTY = {
  id: "prop-1",
  ownerId: "user-1",
  type: "RENTED",
};
const SELF_OCCUPIED_PROPERTY = {
  id: "prop-1",
  ownerId: "user-1",
  type: "SELF_OCCUPIED",
};

beforeEach(() => {
  mockReset(dbMock);
  getSessionMock.mockReset().mockResolvedValue(SESSION);
  redirect.mockClear();
  revalidatePath.mockClear();
});

function buildRentalForm(overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    propertyId: "prop-1",
    label: "2nd floor",
    floor: "2",
    areaSqft: "450",
    ...overrides,
  };

  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return formData;
}

describe("createRental", () => {
  it("redirects to / when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(createRental(buildRentalForm())).rejects.toThrow(
      "REDIRECT:/",
    );
  });

  it("refuses to create a rental unit for a property the user doesn't own", async () => {
    dbMock.property.findFirst.mockResolvedValue(null);

    await expect(createRental(buildRentalForm())).rejects.toThrow(
      "Property not found",
    );
    expect(dbMock.room.create).not.toHaveBeenCalled();
  });

  it("refuses to create a rental unit for a self-occupied property", async () => {
    dbMock.property.findFirst.mockResolvedValue(
      SELF_OCCUPIED_PROPERTY as never,
    );

    await expect(createRental(buildRentalForm())).rejects.toThrow(
      "Self-occupied properties can't have rental units",
    );
    expect(dbMock.room.create).not.toHaveBeenCalled();
  });

  it("rejects a missing label before writing anything", async () => {
    dbMock.property.findFirst.mockResolvedValue(RENTED_PROPERTY as never);

    await expect(
      createRental(buildRentalForm({ label: "   " })),
    ).rejects.toThrow("Enter a label for this rental unit");
    expect(dbMock.room.create).not.toHaveBeenCalled();
  });

  it("rejects a non-positive area", async () => {
    dbMock.property.findFirst.mockResolvedValue(RENTED_PROPERTY as never);

    await expect(
      createRental(buildRentalForm({ areaSqft: "0" })),
    ).rejects.toThrow("Enter a valid area");
    expect(dbMock.room.create).not.toHaveBeenCalled();
  });

  it("creates the room and redirects to the rentals list", async () => {
    dbMock.property.findFirst.mockResolvedValue(RENTED_PROPERTY as never);
    dbMock.room.create.mockResolvedValue({ id: "room-1" } as never);

    await expect(createRental(buildRentalForm())).rejects.toThrow(
      "REDIRECT:/properties/prop-1/rentals",
    );

    expect(dbMock.room.create).toHaveBeenCalledWith({
      data: {
        propertyId: "prop-1",
        label: "2nd floor",
        floor: "2",
        areaSqft: 450,
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/properties/prop-1/rentals");
  });

  it("treats a whitespace-only floor as absent (null) and a blank area as null", async () => {
    dbMock.property.findFirst.mockResolvedValue(RENTED_PROPERTY as never);
    dbMock.room.create.mockResolvedValue({ id: "room-1" } as never);

    const formData = buildRentalForm({ floor: "   " });
    formData.set("areaSqft", "");

    await expect(createRental(formData)).rejects.toThrow("REDIRECT:");

    expect(dbMock.room.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ floor: null, areaSqft: null }),
    });
  });
});
