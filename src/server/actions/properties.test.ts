import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { getSession } from "~/server/better-auth/server";
import { createProperty, deleteProperty, updateProperty } from "./properties";

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

beforeEach(() => {
  mockReset(dbMock);
  getSessionMock.mockReset().mockResolvedValue(SESSION);
  redirect.mockClear();
  revalidatePath.mockClear();
});

/** No dependent records found for any of `hasDependentRecordsForProperty`'s checks. */
function mockNoDependents() {
  dbMock.bill.findFirst.mockResolvedValue(null);
  dbMock.lease.findFirst.mockResolvedValue(null);
  dbMock.room.findFirst.mockResolvedValue(null);
  dbMock.billSchedule.findFirst.mockResolvedValue(null);
  dbMock.loan.findFirst.mockResolvedValue(null);
}

function buildPropertyForm(overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    name: "Whitefield Apartment",
    type: "RENTED",
    addressLine1: "12 MG Road",
    addressLine2: "Near Metro Station",
    city: "Bengaluru",
    state: "Karnataka",
    pinCode: "560066",
    country: "India",
    purchasePrice: "8000000",
    currentEstimatedValue: "9500000",
    purchaseDate: "2020-06-15",
    ...overrides,
  };

  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return formData;
}

describe("createProperty", () => {
  it("redirects to / when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(createProperty(buildPropertyForm())).rejects.toThrow(
      "REDIRECT:/",
    );
  });

  it("rejects a missing name", async () => {
    await expect(
      createProperty(buildPropertyForm({ name: "  " })),
    ).rejects.toThrow("Enter a name");
    expect(dbMock.property.create).not.toHaveBeenCalled();
  });

  it("rejects a missing address", async () => {
    await expect(
      createProperty(buildPropertyForm({ addressLine1: "" })),
    ).rejects.toThrow("Enter the address");
    expect(dbMock.property.create).not.toHaveBeenCalled();
  });

  it("rejects a missing city, state or PIN code", async () => {
    await expect(
      createProperty(buildPropertyForm({ city: "" })),
    ).rejects.toThrow("Enter the city");
    await expect(
      createProperty(buildPropertyForm({ state: "" })),
    ).rejects.toThrow("Enter the state");
    await expect(
      createProperty(buildPropertyForm({ pinCode: "" })),
    ).rejects.toThrow("Enter the PIN code");
    expect(dbMock.property.create).not.toHaveBeenCalled();
  });

  it("rejects an unparseable purchase date", async () => {
    await expect(
      createProperty(buildPropertyForm({ purchaseDate: "not-a-date" })),
    ).rejects.toThrow("Enter a valid purchase date");
    expect(dbMock.property.create).not.toHaveBeenCalled();
  });

  it("creates the property scoped to the signed-in owner, then redirects", async () => {
    dbMock.property.create.mockResolvedValue({ id: "prop-1" } as never);

    await expect(createProperty(buildPropertyForm())).rejects.toThrow(
      "REDIRECT:/properties",
    );

    expect(dbMock.property.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerId: "user-1",
        name: "Whitefield Apartment",
        type: "RENTED",
        city: "Bengaluru",
        purchasePrice: 8000000,
        currentEstimatedValue: 9500000,
      }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/properties");
  });

  it("defaults country to India and treats optional fields left blank as null", async () => {
    dbMock.property.create.mockResolvedValue({ id: "prop-1" } as never);

    await expect(
      createProperty(
        buildPropertyForm({
          addressLine2: "",
          country: "",
          purchasePrice: "",
          currentEstimatedValue: "",
          purchaseDate: "",
        }),
      ),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.property.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        addressLine2: null,
        country: "India",
        purchasePrice: null,
        currentEstimatedValue: null,
        purchaseDate: null,
      }),
    });
  });
});

describe("updateProperty", () => {
  it("redirects to / when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(
      updateProperty("prop-1", buildPropertyForm()),
    ).rejects.toThrow("REDIRECT:/");
  });

  it("throws when the property doesn't belong to this owner", async () => {
    dbMock.property.findFirst.mockResolvedValue(null);

    await expect(
      updateProperty("prop-1", buildPropertyForm()),
    ).rejects.toThrow("Property not found");
    expect(dbMock.property.update).not.toHaveBeenCalled();
  });

  it("updates every editable field, then redirects", async () => {
    dbMock.property.findFirst.mockResolvedValue({
      id: "prop-1",
      ownerId: "user-1",
    } as never);
    dbMock.property.update.mockResolvedValue({ id: "prop-1" } as never);

    await expect(
      updateProperty(
        "prop-1",
        buildPropertyForm({ name: "Updated Name", city: "Mumbai" }),
      ),
    ).rejects.toThrow("REDIRECT:/properties");

    expect(dbMock.property.update).toHaveBeenCalledWith({
      where: { id: "prop-1" },
      data: expect.objectContaining({ name: "Updated Name", city: "Mumbai" }),
    });
    expect(revalidatePath).toHaveBeenCalledWith("/properties");
    expect(revalidatePath).toHaveBeenCalledWith("/properties/prop-1");
  });
});

describe("deleteProperty", () => {
  it("redirects to / when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(deleteProperty("prop-1")).rejects.toThrow("REDIRECT:/");
  });

  it("throws when the property doesn't belong to this owner", async () => {
    dbMock.property.findFirst.mockResolvedValue(null);

    await expect(deleteProperty("prop-1")).rejects.toThrow(
      "Property not found",
    );
    expect(dbMock.property.update).not.toHaveBeenCalled();
  });

  it("refuses to delete a property that has dependent records", async () => {
    dbMock.property.findFirst.mockResolvedValue({
      id: "prop-1",
      ownerId: "user-1",
    } as never);
    mockNoDependents();
    dbMock.lease.findFirst.mockResolvedValue({ id: "lease-1" } as never);

    await expect(deleteProperty("prop-1")).rejects.toThrow(
      "Cannot delete a property that has leases, rental units, utilities or bills on record",
    );
    expect(dbMock.property.update).not.toHaveBeenCalled();
  });

  it("soft-deletes the property, then redirects", async () => {
    dbMock.property.findFirst.mockResolvedValue({
      id: "prop-1",
      ownerId: "user-1",
    } as never);
    mockNoDependents();
    dbMock.property.update.mockResolvedValue({ id: "prop-1" } as never);

    await expect(deleteProperty("prop-1")).rejects.toThrow(
      "REDIRECT:/properties",
    );

    expect(dbMock.property.update).toHaveBeenCalledWith({
      where: { id: "prop-1" },
      data: { deletedAt: expect.any(Date) },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/properties");
  });
});
