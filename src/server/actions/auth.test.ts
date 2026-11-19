import { APIError } from "better-auth";

import { auth } from "~/server/better-auth";
import { allowAuthAttempt } from "~/server/rate-limit";
import { signInWithEmail, signUpWithEmail } from "./auth";

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
      signInEmail: jest.fn(),
      signUpEmail: jest.fn(),
      signInSocial: jest.fn(),
      sendVerificationEmail: jest.fn(),
    },
  },
}));
jest.mock("~/server/better-auth/config", () => ({
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
}));
jest.mock("~/server/rate-limit", () => ({
  allowAuthAttempt: jest.fn(),
  RATE_LIMITED_MESSAGE: "Too many attempts",
}));
jest.mock("next/headers", () => ({
  headers: jest.fn(async () => new Headers()),
}));
jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

const signInMock = auth.api.signInEmail as unknown as jest.Mock;
const signUpMock = auth.api.signUpEmail as unknown as jest.Mock;
const resendMock = auth.api.sendVerificationEmail as unknown as jest.Mock;
const allowMock = allowAuthAttempt as jest.Mock;

function form(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

const SIGN_IN = { email: "owner@example.com", password: "hunter2hunter2" };
const SIGN_UP = {
  name: "Ananya Rao",
  email: "owner@example.com",
  password: "correct horse",
  confirmPassword: "correct horse",
};

beforeEach(() => {
  signInMock.mockReset().mockResolvedValue({});
  signUpMock.mockReset().mockResolvedValue({});
  resendMock.mockReset().mockResolvedValue({ status: true });
  allowMock.mockReset().mockResolvedValue(true);
});

describe("signInWithEmail", () => {
  it("signs in and goes to the dashboard", async () => {
    await expect(signInWithEmail(form(SIGN_IN))).rejects.toThrow(
      "REDIRECT:/dashboard",
    );
    expect(allowMock).toHaveBeenCalledWith("signIn", "owner@example.com");
    expect(signInMock).toHaveBeenCalledWith({
      body: SIGN_IN,
      headers: expect.any(Headers),
    });
  });

  it("refuses once the email or IP has tried too often", async () => {
    allowMock.mockResolvedValue(false);

    await expect(signInWithEmail(form(SIGN_IN))).rejects.toThrow(
      "REDIRECT:/login?error=Too%20many%20attempts",
    );
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("shows better-auth's message for a wrong password", async () => {
    signInMock.mockRejectedValue(
      new APIError("UNAUTHORIZED", {
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Invalid email or password",
      }),
    );

    await expect(signInWithEmail(form(SIGN_IN))).rejects.toThrow(
      "REDIRECT:/login?error=Invalid%20email%20or%20password",
    );
  });

  it("sends a fresh link to an unconfirmed account", async () => {
    signInMock.mockRejectedValue(
      new APIError("FORBIDDEN", { code: "EMAIL_NOT_VERIFIED" }),
    );

    await expect(signInWithEmail(form(SIGN_IN))).rejects.toThrow(
      "REDIRECT:/login?unverified=1",
    );
    expect(allowMock).toHaveBeenCalledWith(
      "verificationEmail",
      "owner@example.com",
    );
    expect(resendMock).toHaveBeenCalledWith({
      body: { email: "owner@example.com", callbackURL: "/login?verified=1" },
      headers: expect.any(Headers),
    });
  });

  it("doesn't resend past the verification-email limit", async () => {
    signInMock.mockRejectedValue(
      new APIError("FORBIDDEN", { code: "EMAIL_NOT_VERIFIED" }),
    );
    allowMock.mockImplementation(async (action: string) => action === "signIn");

    await expect(signInWithEmail(form(SIGN_IN))).rejects.toThrow(
      "REDIRECT:/login?unverified=1",
    );
    expect(resendMock).not.toHaveBeenCalled();
  });

  it("rejects an empty password before counting", async () => {
    await expect(
      signInWithEmail(form({ email: "owner@example.com", password: "" })),
    ).rejects.toThrow("REDIRECT:/login?error=Enter%20your%20password");
    expect(allowMock).not.toHaveBeenCalled();
  });
});

describe("signUpWithEmail", () => {
  it("creates the account and asks the person to check their inbox", async () => {
    await expect(signUpWithEmail(form(SIGN_UP))).rejects.toThrow(
      "REDIRECT:/sign-up?sent=1",
    );
    expect(allowMock).toHaveBeenCalledWith("signUp", "owner@example.com");
    expect(signUpMock).toHaveBeenCalledWith({
      body: {
        name: "Ananya Rao",
        email: "owner@example.com",
        password: "correct horse",
        callbackURL: "/login?verified=1",
      },
      headers: expect.any(Headers),
    });
  });

  it("refuses once the email or IP has tried too often", async () => {
    allowMock.mockResolvedValue(false);

    await expect(signUpWithEmail(form(SIGN_UP))).rejects.toThrow(
      "REDIRECT:/sign-up?error=Too%20many%20attempts",
    );
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it.each([
    [{ name: "" }, "Enter your name"],
    [{ email: "nope" }, "Enter a valid email"],
    [
      { password: "short", confirmPassword: "short" },
      "Use at least 8 characters",
    ],
    [{ confirmPassword: "different" }, "The passwords don't match"],
  ])("rejects %p", async (fields, message) => {
    await expect(
      signUpWithEmail(form({ ...SIGN_UP, ...fields })),
    ).rejects.toThrow(`REDIRECT:/sign-up?error=${encodeURIComponent(message)}`);
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("shows better-auth's message when sign-up fails", async () => {
    signUpMock.mockRejectedValue(
      new APIError("BAD_REQUEST", { message: "Password too weak" }),
    );

    await expect(signUpWithEmail(form(SIGN_UP))).rejects.toThrow(
      "REDIRECT:/sign-up?error=Password%20too%20weak",
    );
  });
});
