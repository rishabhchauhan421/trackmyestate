/**
 * @jest-environment node
 *
 * `NextRequest` needs the Node `Request`/`fetch` globals, which the
 * project's default jsdom test environment doesn't provide.
 */
import { NextRequest } from "next/server";

jest.mock("~/env", () => ({
  env: { CRON_SECRET: "test-secret" },
}));
jest.mock("~/server/notifications/process", () => ({
  processDueNotificationJobs: jest.fn(),
}));

import { GET } from "./route";
import { processDueNotificationJobs } from "~/server/notifications/process";
import { env } from "~/env";

const processMock = processDueNotificationJobs as jest.Mock;

function buildRequest(authorization?: string) {
  const headers: HeadersInit = authorization ? { authorization } : {};
  return new NextRequest("https://trackmyestate.app/api/cron/notifications", {
    headers,
  });
}

beforeEach(() => {
  processMock.mockReset();
});

describe("GET /api/cron/notifications", () => {
  it("rejects a request without the correct bearer secret", async () => {
    const response = await GET(buildRequest());

    expect(response.status).toBe(401);
    expect(processMock).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong secret", async () => {
    const response = await GET(buildRequest("Bearer wrong-secret"));

    expect(response.status).toBe(401);
    expect(processMock).not.toHaveBeenCalled();
  });

  it("rejects every request when CRON_SECRET isn't configured", async () => {
    const mutableEnv = env as { CRON_SECRET: string | undefined };
    mutableEnv.CRON_SECRET = undefined;

    const response = await GET(buildRequest("Bearer test-secret"));

    expect(response.status).toBe(401);
    mutableEnv.CRON_SECRET = "test-secret";
  });

  it("processes due jobs and returns the summary when authorized", async () => {
    processMock.mockResolvedValue({
      total: 2,
      outcomes: {
        SENT: 2,
        SKIPPED: 0,
        RETRY_SCHEDULED: 0,
        FAILED: 0,
        ALREADY_CLAIMED: 0,
      },
    });

    const response = await GET(buildRequest("Bearer test-secret"));

    expect(processMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      total: 2,
      outcomes: {
        SENT: 2,
        SKIPPED: 0,
        RETRY_SCHEDULED: 0,
        FAILED: 0,
        ALREADY_CLAIMED: 0,
      },
    });
  });
});
