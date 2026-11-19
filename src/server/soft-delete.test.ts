import {
  NOT_DELETED_WHERE,
  appliesSoftDeleteFilter,
  excludeSoftDeleted,
} from "./soft-delete";

describe("excludeSoftDeleted", () => {
  it("filters to non-deleted rows when there is no where", () => {
    expect(excludeSoftDeleted(undefined)).toEqual(NOT_DELETED_WHERE);
    expect(excludeSoftDeleted({})).toEqual(NOT_DELETED_WHERE);
  });

  it("ANDs the filter onto an existing where", () => {
    expect(excludeSoftDeleted({ ownerId: "u1" })).toEqual({
      AND: [{ ownerId: "u1" }, NOT_DELETED_WHERE],
    });
  });

  it("leaves a where that already names deletedAt alone", () => {
    const where = { deletedAt: { not: null } };
    expect(excludeSoftDeleted(where)).toBe(where);
    const nested = { AND: [{ ownerId: "u1" }, { OR: [{ deletedAt: null }] }] };
    expect(excludeSoftDeleted(nested)).toBe(nested);
  });

  it("doesn't mistake dates for nested filters", () => {
    const where = { dueDate: { gte: new Date("2026-01-01") } };
    expect(excludeSoftDeleted(where)).toEqual({
      AND: [where, NOT_DELETED_WHERE],
    });
  });
});

describe("appliesSoftDeleteFilter", () => {
  it("applies to reads on soft-deletable models", () => {
    expect(appliesSoftDeleteFilter("Bill", "findMany")).toBe(true);
    expect(appliesSoftDeleteFilter("Property", "aggregate")).toBe(true);
    expect(appliesSoftDeleteFilter("Loan", "count")).toBe(true);
  });

  it("skips writes, unique lookups and models without deletedAt", () => {
    expect(appliesSoftDeleteFilter("Bill", "update")).toBe(false);
    expect(appliesSoftDeleteFilter("Bill", "findUnique")).toBe(false);
    expect(appliesSoftDeleteFilter("User", "findMany")).toBe(false);
    expect(appliesSoftDeleteFilter("NotificationJob", "findMany")).toBe(false);
  });
});
