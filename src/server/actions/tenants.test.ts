import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { getSession } from "~/server/better-auth/server";
import { createTenant, deleteTenant, endLease, updateTenant } from "./tenants";

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
  currency: "INR",
};
const SELF_OCCUPIED_PROPERTY = {
  id: "prop-1",
  ownerId: "user-1",
  type: "SELF_OCCUPIED",
  currency: "INR",
};

beforeEach(() => {
  mockReset(dbMock);
  getSessionMock.mockReset().mockResolvedValue(SESSION);
  redirect.mockClear();
  revalidatePath.mockClear();
});

function buildTenantForm(overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    propertyId: "prop-1",
    name: "Asha Rao",
    phone: "9876543210",
    email: "asha@example.com",
    leaseStart: "2026-06-01",
    rentAmount: "25000",
    depositAmount: "50000",
    ...overrides,
  };

  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return formData;
}

describe("createTenant", () => {
  it("redirects to / when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(createTenant(buildTenantForm())).rejects.toThrow(
      "REDIRECT:/",
    );
  });

  it("refuses to create a tenant for a property the user doesn't own", async () => {
    dbMock.property.findFirst.mockResolvedValue(null);

    await expect(createTenant(buildTenantForm())).rejects.toThrow(
      "Property not found",
    );
    expect(dbMock.tenant.create).not.toHaveBeenCalled();
  });

  it("refuses to create a tenant for a self-occupied property", async () => {
    dbMock.property.findFirst.mockResolvedValue(
      SELF_OCCUPIED_PROPERTY as never,
    );

    await expect(createTenant(buildTenantForm())).rejects.toThrow(
      "Self-occupied properties can't have tenants",
    );
    expect(dbMock.tenant.create).not.toHaveBeenCalled();
  });

  it("rejects a roomId that doesn't belong to this property", async () => {
    dbMock.property.findFirst.mockResolvedValue(RENTED_PROPERTY as never);
    dbMock.room.findFirst.mockResolvedValue(null);

    await expect(
      createTenant(buildTenantForm({ roomId: "room-x" })),
    ).rejects.toThrow("Rental unit not found");
    expect(dbMock.tenant.create).not.toHaveBeenCalled();
  });

  it("rejects a missing name or phone before writing anything", async () => {
    dbMock.property.findFirst.mockResolvedValue(RENTED_PROPERTY as never);

    await expect(
      createTenant(buildTenantForm({ name: "   " })),
    ).rejects.toThrow("Enter the tenant's name");
    await expect(
      createTenant(buildTenantForm({ phone: "" })),
    ).rejects.toThrow("Enter the tenant's phone number");
    expect(dbMock.tenant.create).not.toHaveBeenCalled();
  });

  it("rejects an unparseable lease start date", async () => {
    dbMock.property.findFirst.mockResolvedValue(RENTED_PROPERTY as never);

    await expect(
      createTenant(buildTenantForm({ leaseStart: "" })),
    ).rejects.toThrow("Enter a valid lease start date");
    expect(dbMock.tenant.create).not.toHaveBeenCalled();
  });

  it("rejects a non-positive rent amount", async () => {
    dbMock.property.findFirst.mockResolvedValue(RENTED_PROPERTY as never);

    await expect(
      createTenant(buildTenantForm({ rentAmount: "0" })),
    ).rejects.toThrow("Enter a valid rent amount");
    expect(dbMock.tenant.create).not.toHaveBeenCalled();
  });

  it("rejects a negative deposit amount", async () => {
    dbMock.property.findFirst.mockResolvedValue(RENTED_PROPERTY as never);

    await expect(
      createTenant(buildTenantForm({ depositAmount: "-1" })),
    ).rejects.toThrow("Enter a valid deposit amount");
    expect(dbMock.tenant.create).not.toHaveBeenCalled();
  });

  it("creates the tenant as active with roomId null (whole property) and redirects", async () => {
    dbMock.property.findFirst.mockResolvedValue(RENTED_PROPERTY as never);
    dbMock.tenant.create.mockResolvedValue({ id: "tenant-1" } as never);

    await expect(createTenant(buildTenantForm())).rejects.toThrow(
      "REDIRECT:/properties/prop-1",
    );

    expect(dbMock.tenant.create).toHaveBeenCalledWith({
      data: {
        propertyId: "prop-1",
        roomId: null,
        name: "Asha Rao",
        phone: "9876543210",
        email: "asha@example.com",
        leaseStart: new Date("2026-06-01"),
        leaseEnd: null,
        rentAmount: 25000,
        depositAmount: 50000,
        currency: "INR",
        active: true,
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/properties/prop-1");
  });

  it("creates the tenant scoped to a rental unit when roomId is valid", async () => {
    dbMock.property.findFirst.mockResolvedValue(RENTED_PROPERTY as never);
    dbMock.room.findFirst.mockResolvedValue({ id: "room-1" } as never);
    dbMock.tenant.create.mockResolvedValue({ id: "tenant-1" } as never);

    await expect(
      createTenant(buildTenantForm({ roomId: "room-1" })),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.tenant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ roomId: "room-1" }),
    });
  });

  it("parses an optional lease end date", async () => {
    dbMock.property.findFirst.mockResolvedValue(RENTED_PROPERTY as never);
    dbMock.tenant.create.mockResolvedValue({ id: "tenant-1" } as never);

    await expect(
      createTenant(buildTenantForm({ leaseEnd: "2027-05-31" })),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.tenant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ leaseEnd: new Date("2027-05-31") }),
    });
  });

  it("treats a whitespace-only email as absent (null)", async () => {
    dbMock.property.findFirst.mockResolvedValue(RENTED_PROPERTY as never);
    dbMock.tenant.create.mockResolvedValue({ id: "tenant-1" } as never);

    await expect(
      createTenant(buildTenantForm({ email: "   " })),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.tenant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: null }),
    });
  });
});

const EXISTING_TENANT = {
  id: "tenant-1",
  propertyId: "prop-1",
  roomId: null,
  active: true,
  leaseEnd: null,
};

function buildLeaseForm(overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    rentAmount: "27000",
    depositAmount: "54000",
    ...overrides,
  };

  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }
  return formData;
}

describe("updateTenant", () => {
  it("redirects to / when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(
      updateTenant("tenant-1", buildLeaseForm()),
    ).rejects.toThrow("REDIRECT:/");
  });

  it("throws when the tenant doesn't belong to this owner", async () => {
    dbMock.tenant.findFirst.mockResolvedValue(null);

    await expect(
      updateTenant("tenant-1", buildLeaseForm()),
    ).rejects.toThrow("Tenant not found");
    expect(dbMock.tenant.update).not.toHaveBeenCalled();
  });

  it("rejects a roomId that doesn't belong to this tenant's property", async () => {
    dbMock.tenant.findFirst.mockResolvedValue(EXISTING_TENANT as never);
    dbMock.room.findFirst.mockResolvedValue(null);

    await expect(
      updateTenant("tenant-1", buildLeaseForm({ roomId: "room-x" })),
    ).rejects.toThrow("Rental unit not found");
    expect(dbMock.tenant.update).not.toHaveBeenCalled();
  });

  it("rejects a non-positive rent amount", async () => {
    dbMock.tenant.findFirst.mockResolvedValue(EXISTING_TENANT as never);

    await expect(
      updateTenant("tenant-1", buildLeaseForm({ rentAmount: "0" })),
    ).rejects.toThrow("Enter a valid rent amount");
    expect(dbMock.tenant.update).not.toHaveBeenCalled();
  });

  it("rejects a negative deposit amount", async () => {
    dbMock.tenant.findFirst.mockResolvedValue(EXISTING_TENANT as never);

    await expect(
      updateTenant("tenant-1", buildLeaseForm({ depositAmount: "-1" })),
    ).rejects.toThrow("Enter a valid deposit amount");
    expect(dbMock.tenant.update).not.toHaveBeenCalled();
  });

  it("rejects an unparseable lease end date", async () => {
    dbMock.tenant.findFirst.mockResolvedValue(EXISTING_TENANT as never);

    await expect(
      updateTenant("tenant-1", buildLeaseForm({ leaseEnd: "not-a-date" })),
    ).rejects.toThrow("Enter a valid lease end date");
    expect(dbMock.tenant.update).not.toHaveBeenCalled();
  });

  it("updates the lease terms and redirects to the property page", async () => {
    dbMock.tenant.findFirst.mockResolvedValue(EXISTING_TENANT as never);
    dbMock.tenant.update.mockResolvedValue({ id: "tenant-1" } as never);

    await expect(
      updateTenant("tenant-1", buildLeaseForm()),
    ).rejects.toThrow("REDIRECT:/properties/prop-1");

    expect(dbMock.tenant.update).toHaveBeenCalledWith({
      where: { id: "tenant-1" },
      data: {
        roomId: null,
        rentAmount: 27000,
        depositAmount: 54000,
        leaseEnd: null,
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/properties/prop-1");
  });

  it("does not touch the tenant's active flag", async () => {
    dbMock.tenant.findFirst.mockResolvedValue(EXISTING_TENANT as never);
    dbMock.tenant.update.mockResolvedValue({ id: "tenant-1" } as never);

    await expect(updateTenant("tenant-1", buildLeaseForm())).rejects.toThrow(
      "REDIRECT:",
    );

    const call = dbMock.tenant.update.mock.calls[0]?.[0];
    expect(Object.keys(call?.data ?? {})).not.toContain("active");
  });

  it("assigns a rental unit when roomId is valid", async () => {
    dbMock.tenant.findFirst.mockResolvedValue(EXISTING_TENANT as never);
    dbMock.room.findFirst.mockResolvedValue({ id: "room-1" } as never);
    dbMock.tenant.update.mockResolvedValue({ id: "tenant-1" } as never);

    await expect(
      updateTenant("tenant-1", buildLeaseForm({ roomId: "room-1" })),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.tenant.update).toHaveBeenCalledWith({
      where: { id: "tenant-1" },
      data: expect.objectContaining({ roomId: "room-1" }),
    });
  });
});

describe("endLease", () => {
  it("redirects to / when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(endLease("tenant-1")).rejects.toThrow("REDIRECT:/");
  });

  it("throws when the tenant doesn't belong to this owner", async () => {
    dbMock.tenant.findFirst.mockResolvedValue(null);

    await expect(endLease("tenant-1")).rejects.toThrow("Tenant not found");
    expect(dbMock.tenant.update).not.toHaveBeenCalled();
  });

  it("marks the tenant inactive and backfills leaseEnd to today when unset", async () => {
    dbMock.tenant.findFirst.mockResolvedValue(EXISTING_TENANT as never);
    dbMock.tenant.update.mockResolvedValue({ id: "tenant-1" } as never);

    await expect(endLease("tenant-1")).rejects.toThrow(
      "REDIRECT:/properties/prop-1",
    );

    expect(dbMock.tenant.update).toHaveBeenCalledWith({
      where: { id: "tenant-1" },
      data: { active: false, leaseEnd: expect.any(Date) as Date },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/properties/prop-1");
  });

  it("preserves an already-set leaseEnd instead of overwriting it", async () => {
    const existingLeaseEnd = new Date("2026-08-15");
    dbMock.tenant.findFirst.mockResolvedValue({
      ...EXISTING_TENANT,
      leaseEnd: existingLeaseEnd,
    } as never);
    dbMock.tenant.update.mockResolvedValue({ id: "tenant-1" } as never);

    await expect(endLease("tenant-1")).rejects.toThrow("REDIRECT:");

    expect(dbMock.tenant.update).toHaveBeenCalledWith({
      where: { id: "tenant-1" },
      data: { active: false, leaseEnd: existingLeaseEnd },
    });
  });
});

describe("deleteTenant", () => {
  it("redirects to / when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(deleteTenant("tenant-1")).rejects.toThrow("REDIRECT:/");
  });

  it("throws when the tenant doesn't belong to this owner", async () => {
    dbMock.tenant.findFirst.mockResolvedValue(null);

    await expect(deleteTenant("tenant-1")).rejects.toThrow(
      "Tenant not found",
    );
    expect(dbMock.tenant.update).not.toHaveBeenCalled();
  });

  it("refuses to delete a tenant that has a rent bill on record", async () => {
    dbMock.tenant.findFirst.mockResolvedValue(EXISTING_TENANT as never);
    dbMock.bill.findFirst.mockResolvedValue({ id: "bill-1" } as never);

    await expect(deleteTenant("tenant-1")).rejects.toThrow(
      "Cannot delete a tenant that has bills on record",
    );
    expect(dbMock.tenant.update).not.toHaveBeenCalled();
  });

  it("checks for RENT-category bills scoped to this tenant as sourceId", async () => {
    dbMock.tenant.findFirst.mockResolvedValue(EXISTING_TENANT as never);
    dbMock.bill.findFirst.mockResolvedValue(null);
    dbMock.tenant.update.mockResolvedValue({ id: "tenant-1" } as never);

    await expect(deleteTenant("tenant-1")).rejects.toThrow("REDIRECT:");

    expect(dbMock.bill.findFirst).toHaveBeenCalledWith({
      where: { category: "RENT", sourceId: "tenant-1" },
      select: { id: true },
    });
  });

  it("soft-deletes the tenant and redirects when there are no bills", async () => {
    dbMock.tenant.findFirst.mockResolvedValue(EXISTING_TENANT as never);
    dbMock.bill.findFirst.mockResolvedValue(null);
    dbMock.tenant.update.mockResolvedValue({ id: "tenant-1" } as never);

    await expect(deleteTenant("tenant-1")).rejects.toThrow(
      "REDIRECT:/properties/prop-1",
    );

    expect(dbMock.tenant.update).toHaveBeenCalledWith({
      where: { id: "tenant-1" },
      data: { deletedAt: expect.any(Date) as Date },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/properties/prop-1");
  });
});
