import { act, fireEvent, render, screen } from "@testing-library/react";

import { SubmitButton } from "./submit-button";

describe("SubmitButton", () => {
  it("disables itself and shows the pending label while the action runs", async () => {
    let finish!: () => void;
    const action = jest.fn(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );

    render(
      <form action={action}>
        <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
      </form>,
    );
    const button = screen.getByRole("button", { name: "Sign in" });
    expect(button).toBeEnabled();

    await act(async () => {
      fireEvent.click(button);
    });

    expect(action).toHaveBeenCalledTimes(1);
    const busy = screen.getByRole("button", { name: "Signing in…" });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");

    // A second click while pending doesn't submit again.
    await act(async () => {
      fireEvent.click(busy);
    });
    expect(action).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish();
    });
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("stays disabled when disabled is passed", () => {
    render(
      <form>
        <SubmitButton disabled>Delete</SubmitButton>
      </form>,
    );
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });
});
