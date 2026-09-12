import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { getRoomsForProperty } from "~/server/queries/rentals";

jest.mock("~/server/db");

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(dbMock);
});

describe("getRoomsForProperty", () => {
  it("queries rooms scoped to the given property", async () => {
    dbMock.room.findMany.mockResolvedValue([]);

    await getRoomsForProperty("prop-1");

    const call = dbMock.room.findMany.mock.calls[0]?.[0];
    expect(call?.where).toMatchObject({ propertyId: "prop-1" });
  });

  it("excludes soft-deleted rooms, matching both explicit null and absent deletedAt", async () => {
    dbMock.room.findMany.mockResolvedValue([]);

    await getRoomsForProperty("prop-1");

    const call = dbMock.room.findMany.mock.calls[0]?.[0];
    expect(call?.where).toMatchObject({
      OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
    });
  });

  it("orders rooms by creation order", async () => {
    dbMock.room.findMany.mockResolvedValue([]);

    await getRoomsForProperty("prop-1");

    const call = dbMock.room.findMany.mock.calls[0]?.[0];
    expect(call?.orderBy).toEqual({ createdAt: "asc" });
  });

  it("returns an empty array when the property has no rooms", async () => {
    dbMock.room.findMany.mockResolvedValue([]);

    const result = await getRoomsForProperty("prop-1");

    expect(result).toEqual([]);
  });
});
