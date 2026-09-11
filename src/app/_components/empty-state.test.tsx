import { render, screen } from "@testing-library/react";

import { EmptyState } from "./empty-state";
import { PropertiesIcon } from "./icons";

describe("EmptyState", () => {
  it("renders the title, description and action label", () => {
    render(
      <EmptyState
        Icon={PropertiesIcon}
        title="No properties yet"
        description="Add a property to get started."
        actionLabel="Add your first property"
      />,
    );

    expect(screen.getByText("No properties yet")).toBeInTheDocument();
    expect(
      screen.getByText("Add a property to get started."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add your first property" }),
    ).toBeDisabled();
  });

  it("renders empty strings without crashing", () => {
    const { container } = render(
      <EmptyState Icon={PropertiesIcon} title="" description="" actionLabel="" />,
    );
    expect(container.querySelector("h3")?.textContent).toBe("");
    expect(container.querySelector("button")).toBeDisabled();
  });

  it("renders dynamic text as literal content, not markup", () => {
    render(
      <EmptyState
        Icon={PropertiesIcon}
        title="<img src=x onerror=alert(1)>"
        description="ok"
        actionLabel="go"
      />,
    );
    expect(
      screen.getByText("<img src=x onerror=alert(1)>"),
    ).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("always renders the action button disabled, regardless of label", () => {
    render(
      <EmptyState
        Icon={PropertiesIcon}
        title="t"
        description="d"
        actionLabel="Click me"
      />,
    );
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Coming soon");
  });
});
