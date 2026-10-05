import { APIError } from "better-auth";

import { auth } from "~/server/better-auth";
import { requestPasswordReset, resetPassword } from "./password-reset";

// better-auth is ESM-only, which Jest can't load; only `APIError`'s shape
// (`body.code`/`body.message`) matters here.
jest.mock("better-auth", () => ({
  APIError: class APIError extends Error {
    constructor(
      public status: string,
      public body?: { code?: string; message?: string },
    ) {
      super(body?.message);
    }
  },
}));
jest.mock("~/server/better-auth", () => ({
  auth: {
    api: {
      requestPasswordReset: jest.fn(),
      resetPassword: jest.fn(),
    },
  },
}));
jest.mock("~/server/better-auth/config", () => ({
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
}));
jest.mock("next/headers", () => ({
  headers: jest.fn(async () => new Headers()),
}));
jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

const requestMock = auth.api.requestPasswordReset as unknown as jest.Mock;
const resetMock = auth.api.resetPassword as unknown as jest.Mock;

function form(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

beforeEach(() => {
  requestMock.mockReset().mockResolvedValue({ status: true });
  resetMock.mockReset().mockResolvedValue({ status: true });
});

describe("requestPasswordReset", () => {
  it("asks better-auth to email a link back to /reset-password", async () => {
    await expect(
      requestPasswordReset(form({ email: " owner@example.com " })),
    ).rejects.toThrow("REDIRECT:/forgot-password?sent=1");

    expect(requestMock).toHaveBeenCalledWith({
      body: { email: "owner@example.com", redirectTo: "/reset-password" },
      headers: expect.any(Headers),
    });
  });

  it("rejects an invalid email without calling better-auth", async () => {
    await expect(
      requestPasswordReset(form({ email: "not-an-email" })),
    ).rejects.toThrow(
      `REDIRECT:/forgot-password?error=${encodeURIComponent("Enter a valid email")}`,
    );
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("reports a better-auth failure back to the form", async () => {
    requestMock.mockRejectedValue(
      new APIError("TOO_MANY_REQUESTS", { message: "Too many requests" }),
    );

    await expect(
      requestPasswordReset(form({ email: "owner@example.com" })),
    ).rejects.toThrow(
      `REDIRECT:/forgot-password?error=${encodeURIComponent("Too many requests")}`,
    );
  });
});

describe("resetPassword", () => {
  const valid = {
    token: "tok-1",
    password: "correct horse",
    confirmPassword: "correct horse",
  };

  it("sets the new password and sends the user to sign in", async () => {
    await expect(resetPassword(form(valid))).rejects.toThrow(
      "REDIRECT:/login?reset=1",
    );

    expect(resetMock).toHaveBeenCalledWith({
      body: { token: "tok-1", newPassword: "correct horse" },
      headers: expect.any(Headers),
    });
  });

  it.each([
    [
      { password: "short", confirmPassword: "short" },
      "Use at least 8 characters",
    ],
    [{ confirmPassword: "something else" }, "The passwords don't match"],
  ])("rejects %p with %p", async (overrides, message) => {
    await expect(
      resetPassword(form({ ...valid, ...overrides })),
    ).rejects.toThrow(
      `REDIRECT:/reset-password?token=tok-1&error=${encodeURIComponent(message)}`,
    );
    expect(resetMock).not.toHaveBeenCalled();
  });

  it("sends an expired or used token to the invalid-link state", async () => {
    resetMock.mockRejectedValue(
      new APIError("BAD_REQUEST", {
        code: "INVALID_TOKEN",
        message: "Invalid token",
      }),
    );

    await expect(resetPassword(form(valid))).rejects.toThrow(
      "REDIRECT:/reset-password?error=INVALID_TOKEN",
    );
  });
});
