const sendMock = jest.fn();

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

jest.mock("~/env", () => ({
  env: {
    RESEND_API_KEY: "re_test_key",
    NOTIFICATIONS_EMAIL_FROM: "notifications@trackmyestate.app",
    NEXT_PUBLIC_SITE_URL: "https://trackmyestate.app",
  },
}));

import { sendEmail } from "./email";
import { env } from "~/env";
import type { NotificationJobWithMetadata } from "../types";

const JOB = {
  id: "job-1",
  channel: "EMAIL",
  recipient: "owner@example.com",
  title: "Rent due in 3 days",
  body: "₹25,000 rent for Green Villa is due on 15 Sep.",
  metadata: { actionUrl: "https://trackmyestate.app/properties/prop-1" },
} as unknown as NotificationJobWithMetadata;

beforeEach(() => {
  sendMock.mockReset();
});

describe("sendEmail", () => {
  it("sends via Resend and reports success with the provider message id", async () => {
    sendMock.mockResolvedValue({ data: { id: "resend-msg-1" }, error: null });

    const result = await sendEmail(JOB);

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "notifications@trackmyestate.app",
        to: "owner@example.com",
        subject: "Rent due in 3 days",
      }),
    );
    expect(result).toEqual({ ok: true, providerMessageId: "resend-msg-1" });
  });

  it("reports a non-retryable failure for a 4xx Resend error", async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: {
        name: "invalid_from_address",
        statusCode: 422,
        message: "Invalid from address",
      },
    });

    const result = await sendEmail(JOB);

    expect(result).toEqual({
      ok: false,
      retryable: false,
      reason: "Invalid from address",
    });
  });

  it("reports a retryable failure for a 5xx Resend error", async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: {
        name: "internal_server_error",
        statusCode: 500,
        message: "Something went wrong",
      },
    });

    const result = await sendEmail(JOB);

    expect(result).toEqual({
      ok: false,
      retryable: true,
      reason: "Something went wrong",
    });
  });

  it("treats a 429 rate limit as retryable", async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: {
        name: "rate_limit_exceeded",
        statusCode: 429,
        message: "Too many requests",
      },
    });

    const result = await sendEmail(JOB);

    expect(result.ok).toBe(false);
    expect((result as { retryable: boolean }).retryable).toBe(true);
  });

  it("fails fast without calling Resend when no API key is configured", async () => {
    const mutableEnv = env as { RESEND_API_KEY: string | undefined };
    const original = mutableEnv.RESEND_API_KEY;
    mutableEnv.RESEND_API_KEY = undefined;

    const result = await sendEmail(JOB);

    expect(sendMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      retryable: false,
      reason: "RESEND_API_KEY is not configured",
    });

    mutableEnv.RESEND_API_KEY = original;
  });
});
