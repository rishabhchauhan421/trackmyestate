import { render, screen, within } from "@testing-library/react";

import { PageHeader, propertyCrumbs } from "./page-header";

describe("PageHeader", () => {
  it("renders title and description", () => {
    render(<PageHeader title="Properties" description="Your portfolio" />);

    expect(
      screen.getByRole("heading", { name: "Properties" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Your portfolio")).toBeInTheDocument();
  });

  it("renders the optional action node when provided", () => {
    render(
      <PageHeader
        title="Properties"
        description="Your portfolio"
        action={<button type="button">Add property</button>}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Add property" }),
    ).toBeInTheDocument();
  });

  it("renders nothing extra when no action is given", () => {
    render(<PageHeader title="Properties" description="Your portfolio" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders nothing extra when action is explicitly null", () => {
    const { container } = render(
      <PageHeader
        title="Properties"
        description="Your portfolio"
        action={null}
      />,
    );
    // React renders `null` as nothing, but a falsy-but-not-null action
    // (like `0` or `false`) is a classic React footgun that prints "0" to
    // the page — guard specifically against that regression.
    expect(container.textContent).not.toContain("0");
    expect(container.textContent).not.toContain("false");
  });

  it("renders empty title and description without crashing", () => {
    render(<PageHeader title="" description="" />);
    const heading = screen.getByRole("heading");
    expect(heading.textContent).toBe("");
  });

  it("renders dynamic title/description text literally, not as markup", () => {
    render(<PageHeader title="<b>bold</b>" description="<i>italic</i>" />);
    expect(screen.getByText("<b>bold</b>")).toBeInTheDocument();
    expect(screen.getByText("<i>italic</i>")).toBeInTheDocument();
    expect(document.querySelector("b")).toBeNull();
    expect(document.querySelector("i")).toBeNull();
  });
});

describe("PageHeader breadcrumbs", () => {
  it("links every ancestor and marks the last item as the current page", () => {
    render(
      <PageHeader
        title="Edit lease"
        description="Change terms"
        breadcrumbs={[
          ...propertyCrumbs({ id: "p1", name: "Whitefield Flat" }, "Leases"),
          { label: "Edit lease" },
        ]}
      />,
    );

    const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
    const links = within(trail).getAllByRole("link");
    expect(
      links.map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["Properties", "/properties"],
      ["Whitefield Flat", "/properties/p1"],
      ["Leases", "/properties/p1/leases"],
    ]);
    const current = within(trail).getByText("Edit lease");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current.closest("a")).toBeNull();
  });

  it("renders no trail when none is given", () => {
    render(<PageHeader title="Dashboard" description="Overview" />);
    expect(
      screen.queryByRole("navigation", { name: "Breadcrumb" }),
    ).not.toBeInTheDocument();
  });
});
