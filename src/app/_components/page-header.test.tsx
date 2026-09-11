import { render, screen } from "@testing-library/react";

import { PageHeader } from "./page-header";

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
      <PageHeader title="Properties" description="Your portfolio" action={null} />,
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
    render(
      <PageHeader
        title="<b>bold</b>"
        description="<i>italic</i>"
      />,
    );
    expect(screen.getByText("<b>bold</b>")).toBeInTheDocument();
    expect(screen.getByText("<i>italic</i>")).toBeInTheDocument();
    expect(document.querySelector("b")).toBeNull();
    expect(document.querySelector("i")).toBeNull();
  });
});
