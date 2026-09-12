import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { getDocumentsForLease } from "~/server/queries/documents";

jest.mock("~/server/db");

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(dbMock);
});

describe("getDocumentsForLease", () => {
  it("queries documents scoped to both the owner and the lease's leaseId", async () => {
    dbMock.document.findMany.mockResolvedValue([]);

    await getDocumentsForLease("lease-1", "owner-1");

    const call = dbMock.document.findMany.mock.calls[0]?.[0];
    expect(call?.where).toMatchObject({
      ownerId: "owner-1",
      leaseId: "lease-1",
    });
  });

  it("excludes soft-deleted documents, matching both explicit null and absent deletedAt", async () => {
    dbMock.document.findMany.mockResolvedValue([]);

    await getDocumentsForLease("lease-1", "owner-1");

    const call = dbMock.document.findMany.mock.calls[0]?.[0];
    expect(call?.where).toMatchObject({
      OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
    });
  });

  it("orders documents newest-uploaded first", async () => {
    dbMock.document.findMany.mockResolvedValue([]);

    await getDocumentsForLease("lease-1", "owner-1");

    const call = dbMock.document.findMany.mock.calls[0]?.[0];
    expect(call?.orderBy).toEqual({ uploadedAt: "desc" });
  });

  it("returns an empty array when no documents are attached", async () => {
    dbMock.document.findMany.mockResolvedValue([]);

    const result = await getDocumentsForLease("lease-1", "owner-1");

    expect(result).toEqual([]);
  });
});
