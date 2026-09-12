import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { getSession } from "~/server/better-auth/server";
import { createLease, deleteLease, endLease, updateLease } from "./leases";

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

function buildLeaseForm(overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    propertyId: "prop-1",
    tenantName: "Asha Rao",
    tenantPhone: "9876543210",
    tenantEmail: "asha@example.com",
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

describe("createLease", () => {
  it("redirects to / when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(createLease(buildLeaseForm())).rejects.toThrow(
      "REDIRECT:/",
    );
  });

  it("refuses to create a lease for a property the user doesn't own", async () => {
    dbMock.property.findFirst.mockResolvedValue(null);

    await expect(createLease(buildLeaseForm())).rejects.toThrow(
      "Property not found",
    );
    expect(dbMock.lease.create).not.toHaveBeenCalled();
  });

  it("refuses to create a lease for a self-occupied property", async () => {
    dbMock.property.findFirst.mockResolvedValue(
      SELF_OCCUPIED_PROPERTY as never,
    );

    await expect(createLease(buildLeaseForm())).rejects.toThrow(
      "Self-occupied properties can't have leases",
    );
    expect(dbMock.lease.create).not.toHaveBeenCalled();
  });

  it("rejects a roomId that doesn't belong to this property", async () => {
    dbMock.property.findFirst.mockResolvedValue(RENTED_PROPERTY as never);
    dbMock.room.findFirst.mockResolvedValue(null);

    await expect(
      createLease(buildLeaseForm({ roomId: "room-x" })),
    ).rejects.toThrow("Rental unit not found");
    expect(dbMock.lease.create).not.toHaveBeenCalled();
  });

  it("rejects a missing tenant name or phone before writing anything", async () => {
    dbMock.property.findFirst.mockResolvedValue(RENTED_PROPERTY as never);

    await expect(
      createLease(buildLeaseForm({ tenantName: "   " })),
    ).rejects.toThrow("Enter the tenant's name");
    await expect(
      createLease(buildLeaseForm({ tenantPhone: "" })),
    ).rejects.toThrow("Enter the tenant's phone number");
    expect(dbMock.lease.create).not.toHaveBeenCalled();
  });

  it("rejects an unparseable lease start date", async () => {
    dbMock.property.findFirst.mockResolvedValue(RENTED_PROPERTY as never);

    await expect(
      createLease(buildLeaseForm({ leaseStart: "" })),
    ).rejects.toThrow("Enter a valid lease start date");
    expect(dbMock.lease.create).not.toHaveBeenCalled();
  });

  it("rejects a non-positive rent amount", async () => {
    dbMock.property.findFirst.mockResolvedValue(RENTED_PROPERTY as never);

    await expect(
      createLease(buildLeaseForm({ rentAmount: "0" })),
    ).rejects.toThrow("Enter a valid rent amount");
    expect(dbMock.lease.create).not.toHaveBeenCalled();
  });

  it("rejects a negative deposit amount", async () => {
    dbMock.property.findFirst.mockResolvedValue(RENTED_PROPERTY as never);

    await expect(
      createLease(buildLeaseForm({ depositAmount: "-1" })),
    ).rejects.toThrow("Enter a valid deposit amount");
    expect(dbMock.lease.create).not.toHaveBeenCalled();
  });

  it("creates the lease as active with roomId null (whole property) and redirects", async () => {
    dbMock.property.findFirst.mockResolvedValue(RENTED_PROPERTY as never);
    dbMock.lease.create.mockResolvedValue({ id: "lease-1" } as never);

    await expect(createLease(buildLeaseForm())).rejects.toThrow(
      "REDIRECT:/properties/prop-1",
    );

    expect(dbMock.lease.create).toHaveBeenCalledWith({
      data: {
        propertyId: "prop-1",
        roomId: null,
        tenantName: "Asha Rao",
        tenantPhone: "9876543210",
        tenantEmail: "asha@example.com",
        leaseStart: new Date("2026-06-01"),
        leaseEnd: null,
        rentAmount: 25000,
        rentDueDay: null,
        depositAmount: 50000,
        currency: "INR",
        active: true,
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/properties/prop-1");
  });

  it("rejects an out-of-range or non-integer rent due day", async () => {
    dbMock.property.findFirst.mockResolvedValue(RENTED_PROPERTY as never);

    await expect(
      createLease(buildLeaseForm({ rentDueDay: "0" })),
    ).rejects.toThrow("Enter a valid rent due day (1-31)");
    await expect(
      createLease(buildLeaseForm({ rentDueDay: "32" })),
    ).rejects.toThrow("Enter a valid rent due day (1-31)");
    await expect(
      createLease(buildLeaseForm({ rentDueDay: "5.5" })),
    ).rejects.toThrow("Enter a valid rent due day (1-31)");
    expect(dbMock.lease.create).not.toHaveBeenCalled();
  });

  it("parses a valid rent due day", async () => {
    dbMock.property.findFirst.mockResolvedValue(RENTED_PROPERTY as never);
    dbMock.lease.create.mockResolvedValue({ id: "lease-1" } as never);

    await expect(
      createLease(buildLeaseForm({ rentDueDay: "5" })),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.lease.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ rentDueDay: 5 }),
    });
  });

  it("creates the lease scoped to a rental unit when roomId is valid", async () => {
    dbMock.property.findFirst.mockResolvedValue(RENTED_PROPERTY as never);
    dbMock.room.findFirst.mockResolvedValue({ id: "room-1" } as never);
    dbMock.lease.create.mockResolvedValue({ id: "lease-1" } as never);

    await expect(
      createLease(buildLeaseForm({ roomId: "room-1" })),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.lease.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ roomId: "room-1" }),
    });
  });

  it("parses an optional lease end date", async () => {
    dbMock.property.findFirst.mockResolvedValue(RENTED_PROPERTY as never);
    dbMock.lease.create.mockResolvedValue({ id: "lease-1" } as never);

    await expect(
      createLease(buildLeaseForm({ leaseEnd: "2027-05-31" })),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.lease.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ leaseEnd: new Date("2027-05-31") }),
    });
  });

  it("treats a whitespace-only tenant email as absent (null)", async () => {
    dbMock.property.findFirst.mockResolvedValue(RENTED_PROPERTY as never);
    dbMock.lease.create.mockResolvedValue({ id: "lease-1" } as never);

    await expect(
      createLease(buildLeaseForm({ tenantEmail: "   " })),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.lease.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantEmail: null }),
    });
  });
});

const EXISTING_LEASE = {
  id: "lease-1",
  propertyId: "prop-1",
  roomId: null,
  active: true,
  leaseEnd: null,
};

function buildLeaseUpdateForm(overrides: Record<string, string> = {}) {
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

describe("updateLease", () => {
  it("redirects to / when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(
      updateLease("lease-1", buildLeaseUpdateForm()),
    ).rejects.toThrow("REDIRECT:/");
  });

  it("throws when the lease doesn't belong to this owner", async () => {
    dbMock.lease.findFirst.mockResolvedValue(null);

    await expect(
      updateLease("lease-1", buildLeaseUpdateForm()),
    ).rejects.toThrow("Lease not found");
    expect(dbMock.lease.update).not.toHaveBeenCalled();
  });

  it("rejects a roomId that doesn't belong to this lease's property", async () => {
    dbMock.lease.findFirst.mockResolvedValue(EXISTING_LEASE as never);
    dbMock.room.findFirst.mockResolvedValue(null);

    await expect(
      updateLease("lease-1", buildLeaseUpdateForm({ roomId: "room-x" })),
    ).rejects.toThrow("Rental unit not found");
    expect(dbMock.lease.update).not.toHaveBeenCalled();
  });

  it("rejects a non-positive rent amount", async () => {
    dbMock.lease.findFirst.mockResolvedValue(EXISTING_LEASE as never);

    await expect(
      updateLease("lease-1", buildLeaseUpdateForm({ rentAmount: "0" })),
    ).rejects.toThrow("Enter a valid rent amount");
    expect(dbMock.lease.update).not.toHaveBeenCalled();
  });

  it("rejects a negative deposit amount", async () => {
    dbMock.lease.findFirst.mockResolvedValue(EXISTING_LEASE as never);

    await expect(
      updateLease("lease-1", buildLeaseUpdateForm({ depositAmount: "-1" })),
    ).rejects.toThrow("Enter a valid deposit amount");
    expect(dbMock.lease.update).not.toHaveBeenCalled();
  });

  it("rejects an unparseable lease end date", async () => {
    dbMock.lease.findFirst.mockResolvedValue(EXISTING_LEASE as never);

    await expect(
      updateLease("lease-1", buildLeaseUpdateForm({ leaseEnd: "not-a-date" })),
    ).rejects.toThrow("Enter a valid lease end date");
    expect(dbMock.lease.update).not.toHaveBeenCalled();
  });

  it("updates the lease terms and redirects to the property page", async () => {
    dbMock.lease.findFirst.mockResolvedValue(EXISTING_LEASE as never);
    dbMock.lease.update.mockResolvedValue({ id: "lease-1" } as never);

    await expect(
      updateLease("lease-1", buildLeaseUpdateForm()),
    ).rejects.toThrow("REDIRECT:/properties/prop-1");

    expect(dbMock.lease.update).toHaveBeenCalledWith({
      where: { id: "lease-1" },
      data: {
        roomId: null,
        rentAmount: 27000,
        rentDueDay: null,
        depositAmount: 54000,
        leaseEnd: null,
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/properties/prop-1");
  });

  it("rejects an out-of-range rent due day before writing anything", async () => {
    dbMock.lease.findFirst.mockResolvedValue(EXISTING_LEASE as never);

    await expect(
      updateLease("lease-1", buildLeaseUpdateForm({ rentDueDay: "40" })),
    ).rejects.toThrow("Enter a valid rent due day (1-31)");
    expect(dbMock.lease.update).not.toHaveBeenCalled();
  });

  it("parses a valid rent due day", async () => {
    dbMock.lease.findFirst.mockResolvedValue(EXISTING_LEASE as never);
    dbMock.lease.update.mockResolvedValue({ id: "lease-1" } as never);

    await expect(
      updateLease("lease-1", buildLeaseUpdateForm({ rentDueDay: "12" })),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.lease.update).toHaveBeenCalledWith({
      where: { id: "lease-1" },
      data: expect.objectContaining({ rentDueDay: 12 }),
    });
  });

  it("does not touch the lease's active flag", async () => {
    dbMock.lease.findFirst.mockResolvedValue(EXISTING_LEASE as never);
    dbMock.lease.update.mockResolvedValue({ id: "lease-1" } as never);

    await expect(
      updateLease("lease-1", buildLeaseUpdateForm()),
    ).rejects.toThrow("REDIRECT:");

    const call = dbMock.lease.update.mock.calls[0]?.[0];
    expect(Object.keys(call?.data ?? {})).not.toContain("active");
  });

  it("assigns a rental unit when roomId is valid", async () => {
    dbMock.lease.findFirst.mockResolvedValue(EXISTING_LEASE as never);
    dbMock.room.findFirst.mockResolvedValue({ id: "room-1" } as never);
    dbMock.lease.update.mockResolvedValue({ id: "lease-1" } as never);

    await expect(
      updateLease("lease-1", buildLeaseUpdateForm({ roomId: "room-1" })),
    ).rejects.toThrow("REDIRECT:");

    expect(dbMock.lease.update).toHaveBeenCalledWith({
      where: { id: "lease-1" },
      data: expect.objectContaining({ roomId: "room-1" }),
    });
  });
});

describe("endLease", () => {
  it("redirects to / when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(endLease("lease-1")).rejects.toThrow("REDIRECT:/");
  });

  it("throws when the lease doesn't belong to this owner", async () => {
    dbMock.lease.findFirst.mockResolvedValue(null);

    await expect(endLease("lease-1")).rejects.toThrow("Lease not found");
    expect(dbMock.lease.update).not.toHaveBeenCalled();
  });

  it("marks the lease inactive and backfills leaseEnd to today when unset", async () => {
    dbMock.lease.findFirst.mockResolvedValue(EXISTING_LEASE as never);
    dbMock.lease.update.mockResolvedValue({ id: "lease-1" } as never);

    await expect(endLease("lease-1")).rejects.toThrow(
      "REDIRECT:/properties/prop-1",
    );

    expect(dbMock.lease.update).toHaveBeenCalledWith({
      where: { id: "lease-1" },
      data: { active: false, leaseEnd: expect.any(Date) as Date },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/properties/prop-1");
  });

  it("preserves an already-set leaseEnd instead of overwriting it", async () => {
    const existingLeaseEnd = new Date("2026-08-15");
    dbMock.lease.findFirst.mockResolvedValue({
      ...EXISTING_LEASE,
      leaseEnd: existingLeaseEnd,
    } as never);
    dbMock.lease.update.mockResolvedValue({ id: "lease-1" } as never);

    await expect(endLease("lease-1")).rejects.toThrow("REDIRECT:");

    expect(dbMock.lease.update).toHaveBeenCalledWith({
      where: { id: "lease-1" },
      data: { active: false, leaseEnd: existingLeaseEnd },
    });
  });
});

describe("deleteLease", () => {
  it("redirects to / when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(deleteLease("lease-1")).rejects.toThrow("REDIRECT:/");
  });

  it("throws when the lease doesn't belong to this owner", async () => {
    dbMock.lease.findFirst.mockResolvedValue(null);

    await expect(deleteLease("lease-1")).rejects.toThrow("Lease not found");
    expect(dbMock.lease.update).not.toHaveBeenCalled();
  });

  it("refuses to delete a lease that has a rent bill on record", async () => {
    dbMock.lease.findFirst.mockResolvedValue(EXISTING_LEASE as never);
    dbMock.bill.findFirst.mockResolvedValue({ id: "bill-1" } as never);

    await expect(deleteLease("lease-1")).rejects.toThrow(
      "Cannot delete a lease that has bills on record",
    );
    expect(dbMock.lease.update).not.toHaveBeenCalled();
  });

  it("checks for RENT-category bills scoped to this lease's leaseId", async () => {
    dbMock.lease.findFirst.mockResolvedValue(EXISTING_LEASE as never);
    dbMock.bill.findFirst.mockResolvedValue(null);
    dbMock.lease.update.mockResolvedValue({ id: "lease-1" } as never);

    await expect(deleteLease("lease-1")).rejects.toThrow("REDIRECT:");

    expect(dbMock.bill.findFirst).toHaveBeenCalledWith({
      where: { category: "RENT", leaseId: "lease-1" },
      select: { id: true },
    });
  });

  it("soft-deletes the lease and redirects when there are no bills", async () => {
    dbMock.lease.findFirst.mockResolvedValue(EXISTING_LEASE as never);
    dbMock.bill.findFirst.mockResolvedValue(null);
    dbMock.lease.update.mockResolvedValue({ id: "lease-1" } as never);

    await expect(deleteLease("lease-1")).rejects.toThrow(
      "REDIRECT:/properties/prop-1",
    );

    expect(dbMock.lease.update).toHaveBeenCalledWith({
      where: { id: "lease-1" },
      data: { deletedAt: expect.any(Date) as Date },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/properties/prop-1");
  });
});
