import { FormError } from "~/lib/form";
import { toFormState } from "./form-state";

jest.mock("next/navigation", () => ({
  unstable_rethrow: (err: unknown) => {
    if (err instanceof Error && err.message.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
  },
}));

describe("toFormState", () => {
  it("is clear when the action succeeds", async () => {
    await expect(toFormState(async () => "done")).resolves.toEqual({
      error: null,
    });
  });

  it("returns a FormError's message and field", async () => {
    await expect(
      toFormState(async () => {
        throw new FormError("Enter a valid amount", "amount");
      }),
    ).resolves.toEqual({ error: "Enter a valid amount", field: "amount" });
  });

  it("lets a redirect through", async () => {
    await expect(
      toFormState(async () => {
        throw new Error("NEXT_REDIRECT;/loans");
      }),
    ).rejects.toThrow("NEXT_REDIRECT");
  });

  it("rethrows anything else, so bugs reach the error page", async () => {
    await expect(
      toFormState(async () => {
        throw new TypeError("x is undefined");
      }),
    ).rejects.toThrow("x is undefined");
  });
});
