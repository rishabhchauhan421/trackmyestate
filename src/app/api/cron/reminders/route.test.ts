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
jest.mock("~/server/reminders/generate", () => ({
  generateReminders: jest.fn(),
}));

import { GET } from "./route";
import { generateReminders } from "~/server/reminders/generate";
import { env } from "~/env";

const generateMock = generateReminders as jest.Mock;

function buildRequest(authorization?: string) {
  const headers: HeadersInit = authorization ? { authorization } : {};
  return new NextRequest("https://trackmyestate.app/api/cron/reminders", {
    headers,
  });
}

beforeEach(() => {
  generateMock.mockReset();
});

describe("GET /api/cron/reminders", () => {
  it("rejects a request without the correct bearer secret", async () => {
    const response = await GET(buildRequest());

    expect(response.status).toBe(401);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong secret", async () => {
    const response = await GET(buildRequest("Bearer wrong-secret"));

    expect(response.status).toBe(401);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("rejects every request when CRON_SECRET isn't configured", async () => {
    const mutableEnv = env as { CRON_SECRET: string | undefined };
    mutableEnv.CRON_SECRET = undefined;

    const response = await GET(buildRequest("Bearer test-secret"));

    expect(response.status).toBe(401);
    mutableEnv.CRON_SECRET = "test-secret";
  });

  it("queues today's reminders and returns the summary when authorized", async () => {
    generateMock.mockResolvedValue({ scanned: 12, queued: 3, hasMore: false });

    const response = await GET(buildRequest("Bearer test-secret"));

    expect(generateMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      scanned: 12,
      queued: 3,
      hasMore: false,
    });
  });
});
