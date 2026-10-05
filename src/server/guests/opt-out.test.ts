jest.mock("~/env", () => ({
  env: {
    BETTER_AUTH_SECRET: "test-secret",
    NEXT_PUBLIC_SITE_URL: "https://trackmyestate.app",
  },
}));

import { guestOptOutUrl, signGuestOptOut, verifyGuestOptOut } from "./opt-out";

describe("guest opt-out links", () => {
  it("verifies its own signature", () => {
    expect(verifyGuestOptOut("guest-1", signGuestOptOut("guest-1"))).toBe(true);
  });

  it("rejects a signature made for another guest", () => {
    expect(verifyGuestOptOut("guest-2", signGuestOptOut("guest-1"))).toBe(
      false,
    );
  });

  it("rejects a tampered or empty signature", () => {
    expect(verifyGuestOptOut("guest-1", "nope")).toBe(false);
    expect(verifyGuestOptOut("guest-1", "")).toBe(false);
  });

  it("builds a link to the public stop page", () => {
    const url = new URL(guestOptOutUrl("guest-1"));
    expect(url.origin + url.pathname).toBe(
      "https://trackmyestate.app/reminders/stop",
    );
    expect(url.searchParams.get("guest")).toBe("guest-1");
    expect(
      verifyGuestOptOut("guest-1", url.searchParams.get("sig") ?? ""),
    ).toBe(true);
  });
});
