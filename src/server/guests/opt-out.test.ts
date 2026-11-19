jest.mock("~/env", () => ({
  env: {
    BETTER_AUTH_SECRET: "test-secret",
    NEXT_PUBLIC_SITE_URL: "https://trackmyestate.app",
  },
}));

import {
  guestOptOutUrl,
  recipientOptOutUrl,
  signGuestOptOut,
  signRecipientOptOut,
  verifyGuestOptOut,
  verifyRecipientOptOut,
} from "./opt-out";

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

describe("recipient opt-out links", () => {
  it("verifies for the same owner and address, in any case", () => {
    const sig = signRecipientOptOut("owner-1", "Asha@Example.com");
    expect(verifyRecipientOptOut("owner-1", "asha@example.com", sig)).toBe(
      true,
    );
  });

  it("rejects another owner, another address, or a guest signature", () => {
    const sig = signRecipientOptOut("owner-1", "asha@example.com");
    expect(verifyRecipientOptOut("owner-2", "asha@example.com", sig)).toBe(
      false,
    );
    expect(verifyRecipientOptOut("owner-1", "ravi@example.com", sig)).toBe(
      false,
    );
    expect(
      verifyRecipientOptOut(
        "owner-1",
        "asha@example.com",
        signGuestOptOut("owner-1"),
      ),
    ).toBe(false);
  });

  it("builds a link to the public stop page", () => {
    const url = new URL(recipientOptOutUrl("owner-1", "Asha@Example.com"));
    expect(url.pathname).toBe("/reminders/stop");
    expect(url.searchParams.get("owner")).toBe("owner-1");
    expect(url.searchParams.get("email")).toBe("asha@example.com");
  });
});
