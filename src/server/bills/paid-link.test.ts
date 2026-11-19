jest.mock("~/env", () => ({
  env: {
    BETTER_AUTH_SECRET: "test-secret",
    NEXT_PUBLIC_SITE_URL: "https://trackmyestate.app",
  },
}));

import { signGuestOptOut } from "~/server/guests/opt-out";
import { billPaidUrl, signBillPaid, verifyBillPaid } from "./paid-link";

describe("mark-paid links", () => {
  it("verifies its own signature", () => {
    expect(verifyBillPaid("bill-1", signBillPaid("bill-1"))).toBe(true);
  });

  it("rejects a signature made for another bill", () => {
    expect(verifyBillPaid("bill-2", signBillPaid("bill-1"))).toBe(false);
  });

  it("rejects a tampered or empty signature", () => {
    expect(verifyBillPaid("bill-1", "nope")).toBe(false);
    expect(verifyBillPaid("bill-1", "")).toBe(false);
  });

  it("rejects a stop-link signature for the same id", () => {
    expect(verifyBillPaid("abc", signGuestOptOut("abc"))).toBe(false);
  });

  it("builds a link to the confirmation page", () => {
    const url = new URL(billPaidUrl("bill-1"));

    expect(url.origin + url.pathname).toBe(
      "https://trackmyestate.app/reminders/paid",
    );
    expect(url.searchParams.get("bill")).toBe("bill-1");
    expect(verifyBillPaid("bill-1", url.searchParams.get("sig") ?? "")).toBe(
      true,
    );
  });
});
