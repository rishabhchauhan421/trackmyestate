import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import {
  getLeaseForOwner,
  getLeasesForProperty,
  hasBillsForLease,
} from "~/server/queries/leases";

jest.mock("~/server/db");

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(dbMock);
});

describe("getLeasesForProperty", () => {
  it("queries every lease for the property, not just active ones", async () => {
    dbMock.lease.findMany.mockResolvedValue([]);

    await getLeasesForProperty("prop-1");

    const call = dbMock.lease.findMany.mock.calls[0]?.[0];
    expect(call?.where).toMatchObject({ propertyId: "prop-1" });
  });

  it("excludes soft-deleted leases, matching both explicit null and absent deletedAt", async () => {
    dbMock.lease.findMany.mockResolvedValue([]);

    await getLeasesForProperty("prop-1");

    const call = dbMock.lease.findMany.mock.calls[0]?.[0];
    expect(call?.where).toMatchObject({
      OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
    });
  });

  it("orders leases by lease start, newest first", async () => {
    dbMock.lease.findMany.mockResolvedValue([]);

    await getLeasesForProperty("prop-1");

    const call = dbMock.lease.findMany.mock.calls[0]?.[0];
    expect(call?.orderBy).toEqual({ leaseStart: "desc" });
  });

  it("includes the lease's room label for display", async () => {
    dbMock.lease.findMany.mockResolvedValue([]);

    await getLeasesForProperty("prop-1");

    const call = dbMock.lease.findMany.mock.calls[0]?.[0];
    expect(call?.include?.room).toEqual({ select: { label: true } });
  });

  it("returns both active and past leases, unfiltered", async () => {
    const leases = [
      { id: "l1", active: true },
      { id: "l2", active: false },
    ];
    dbMock.lease.findMany.mockResolvedValue(leases as never);

    const result = await getLeasesForProperty("prop-1");

    expect(result).toBe(leases);
  });
});

describe("getLeaseForOwner", () => {
  it("scopes the lookup to the owner through the lease's property relation", async () => {
    dbMock.lease.findFirst.mockResolvedValue(null);

    await getLeaseForOwner("lease-1", "owner-1");

    expect(dbMock.lease.findFirst).toHaveBeenCalledWith({
      where: { id: "lease-1", property: { ownerId: "owner-1" } },
    });
  });

  it("returns null when the lease doesn't exist or belongs to another owner", async () => {
    dbMock.lease.findFirst.mockResolvedValue(null);

    const result = await getLeaseForOwner("lease-1", "owner-1");

    expect(result).toBeNull();
  });

  it("returns the lease when found", async () => {
    const lease = { id: "lease-1", propertyId: "prop-1" };
    dbMock.lease.findFirst.mockResolvedValue(lease as never);

    const result = await getLeaseForOwner("lease-1", "owner-1");

    expect(result).toBe(lease);
  });
});

describe("hasBillsForLease", () => {
  it("queries RENT-category bills scoped to the lease's leaseId", async () => {
    dbMock.bill.findFirst.mockResolvedValue(null);

    await hasBillsForLease("lease-1");

    expect(dbMock.bill.findFirst).toHaveBeenCalledWith({
      where: { category: "RENT", leaseId: "lease-1" },
      select: { id: true },
    });
  });

  it("returns true when a rent bill exists", async () => {
    dbMock.bill.findFirst.mockResolvedValue({ id: "bill-1" } as never);

    const result = await hasBillsForLease("lease-1");

    expect(result).toBe(true);
  });

  it("returns false when no rent bill exists", async () => {
    dbMock.bill.findFirst.mockResolvedValue(null);

    const result = await hasBillsForLease("lease-1");

    expect(result).toBe(false);
  });
});
