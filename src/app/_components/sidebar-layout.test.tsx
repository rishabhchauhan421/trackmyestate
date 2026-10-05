import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { SidebarLayout } from "./sidebar-layout";

let mockPathname = "/dashboard";
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

function renderLayout() {
  return render(
    <SidebarLayout
      navbar={<span>Navbar</span>}
      sidebar={<a href="/settings">Settings</a>}
    >
      <p>Page</p>
    </SidebarLayout>,
  );
}

describe("SidebarLayout mobile sidebar", () => {
  beforeEach(() => {
    mockPathname = "/dashboard";
  });

  it("opens from the menu button", async () => {
    renderLayout();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes when the route changes, e.g. after picking Settings", async () => {
    const { rerender } = renderLayout();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    mockPathname = "/settings";
    await act(async () => {
      rerender(
        <SidebarLayout
          navbar={<span>Navbar</span>}
          sidebar={<a href="/settings">Settings</a>}
        >
          <p>Page</p>
        </SidebarLayout>,
      );
    });

    // Unmounts once its leave transition finishes.
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});
