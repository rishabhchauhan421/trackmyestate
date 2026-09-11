import { render, screen } from "@testing-library/react";

import { MobileNav, SidebarNav } from "./sidebar-nav";

const mockUsePathname = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

describe("SidebarNav", () => {
  it("marks the current route as active", () => {
    mockUsePathname.mockReturnValue("/properties");
    render(<SidebarNav />);

    expect(screen.getByRole("link", { name: /Properties/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: /Dashboard/ }),
    ).not.toHaveAttribute("aria-current");
  });

  it("treats nested routes as active too", () => {
    mockUsePathname.mockReturnValue("/properties/123/utilities");
    render(<SidebarNav />);

    expect(screen.getByRole("link", { name: /Properties/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders every nav item as a link", () => {
    mockUsePathname.mockReturnValue("/dashboard");
    render(<SidebarNav />);

    expect(screen.getAllByRole("link").length).toBeGreaterThanOrEqual(7);
  });

  // isActive checks `pathname.startsWith(href + "/")`, not a bare prefix —
  // without the trailing slash, "/investments-old" would false-positive
  // match the "/investments" nav item.
  it("does not treat a route with a similar prefix as active", () => {
    mockUsePathname.mockReturnValue("/investments-old");
    render(<SidebarNav />);

    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("marks nothing active when the pathname matches no nav item", () => {
    mockUsePathname.mockReturnValue("/");
    render(<SidebarNav />);

    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("still treats a trailing-slash path as active", () => {
    mockUsePathname.mockReturnValue("/properties/");
    render(<SidebarNav />);

    expect(screen.getByRole("link", { name: /Properties/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("MobileNav", () => {
  it("marks the current route as active", () => {
    mockUsePathname.mockReturnValue("/timeline");
    render(<MobileNav />);

    expect(screen.getByRole("link", { name: /Timeline/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("does not treat a route with a similar prefix as active", () => {
    mockUsePathname.mockReturnValue("/investments-old");
    render(<MobileNav />);

    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });
});
