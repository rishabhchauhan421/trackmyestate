import { isAdmin } from "./is-admin";

describe("isAdmin", () => {
  it("is true only for the 'admin' role", () => {
    expect(isAdmin({ role: "admin" })).toBe(true);
  });

  it("is false for a plain user role", () => {
    expect(isAdmin({ role: "user" })).toBe(false);
  });

  it("is false when role is unset (null, undefined, or missing)", () => {
    expect(isAdmin({ role: null })).toBe(false);
    expect(isAdmin({ role: undefined })).toBe(false);
    expect(isAdmin({})).toBe(false);
  });

  it("is false for a null/undefined user (no session)", () => {
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });
});
