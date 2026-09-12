import { isActive, navItems } from "./nav";

describe("isActive", () => {
  it("matches an exact route", () => {
    expect(isActive("/properties", "/properties")).toBe(true);
  });

  it("treats nested routes as active too", () => {
    expect(isActive("/properties/123/utilities", "/properties")).toBe(true);
  });

  it("still treats a trailing-slash path as active", () => {
    expect(isActive("/properties/", "/properties")).toBe(true);
  });

  // Checks `pathname.startsWith(href + "/")`, not a bare prefix — without the
  // trailing slash, "/investments-old" would false-positive match "/investments".
  it("does not treat a route with a similar prefix as active", () => {
    expect(isActive("/investments-old", "/investments")).toBe(false);
  });

  it("does not match an unrelated route", () => {
    expect(isActive("/", "/dashboard")).toBe(false);
  });
});

describe("navItems", () => {
  it("has a unique href for every entry", () => {
    const hrefs = navItems.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
