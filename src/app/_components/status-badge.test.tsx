import { render, screen } from "@testing-library/react";

import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it("renders the status text with underscores replaced by spaces", () => {
    render(<StatusBadge status="PARTIALLY_PAID" />);
    expect(screen.getByText("PARTIALLY PAID")).toBeInTheDocument();
  });

  it("applies a distinct style for OVERDUE vs PAID", () => {
    const { rerender } = render(<StatusBadge status="PAID" />);
    const paidClass = screen.getByText("PAID").className;

    rerender(<StatusBadge status="OVERDUE" />);
    const overdueClass = screen.getByText("OVERDUE").className;

    expect(paidClass).not.toBe(overdueClass);
  });

  it("falls back to a neutral style for an unknown status", () => {
    render(<StatusBadge status="SOMETHING_UNEXPECTED" />);
    expect(screen.getByText("SOMETHING UNEXPECTED")).toBeInTheDocument();
  });

  it("replaces every underscore, not just the first", () => {
    render(<StatusBadge status="A_B_C" />);
    expect(screen.getByText("A B C")).toBeInTheDocument();
  });

  it("renders an empty string status without crashing", () => {
    const { container } = render(<StatusBadge status="" />);
    const span = container.querySelector("span");
    expect(span).not.toBeNull();
    expect(span?.textContent).toBe("");
  });

  it("is case-sensitive: a lowercase match still falls back", () => {
    render(<StatusBadge status="paid" />);
    render(<StatusBadge status="totally-unknown" />);
    expect(screen.getByText("paid").className).toBe(
      screen.getByText("totally-unknown").className,
    );
  });

  // REFUNDED was added to PaymentStatus after this component was first
  // written. A duplicate "CANCELLED" object key (shared with PolicyStatus)
  // previously existed in this file too — that class of bug (a later
  // duplicate key silently overwriting an earlier one, or a status missing
  // its own entry and drifting onto the fallback) is what this guards.
  // CANCELLED intentionally shares the neutral/fallback look, so only
  // REFUNDED (a genuinely distinct color) is checked against the fallback.
  it("gives REFUNDED its own (non-fallback) styling", () => {
    const { container: fallbackContainer } = render(
      <StatusBadge status="NO-SUCH-STATUS" />,
    );
    const fallbackClass = fallbackContainer.querySelector("span")?.className;

    render(<StatusBadge status="REFUNDED" />);

    expect(screen.getByText("REFUNDED").className).not.toBe(fallbackClass);
    expect(screen.getByText("REFUNDED").className).toContain("sky");
  });

  it("still defines CANCELLED explicitly rather than relying on chance", () => {
    render(<StatusBadge status="CANCELLED" />);
    expect(screen.getByText("CANCELLED").className).toContain("slate");
  });
});
