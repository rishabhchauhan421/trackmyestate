/**
 * @jest-environment node
 *
 * `NextRequest` needs the Node `Request`/`fetch` globals, which the
 * project's default jsdom test environment doesn't provide.
 */
import { NextRequest } from "next/server";

jest.mock("~/server/db", () =>
  jest.requireActual<Record<string, unknown>>("~/server/__testing__/memory-db"),
);
jest.mock("~/env", () => ({
  env: { CRON_SECRET: "test-secret" },
}));
jest.mock("~/server/reminders/generate", () => ({
  generateReminders: jest.fn(),
}));
jest.mock("~/server/issues/alerts", () => ({
  generateIssueAlerts: jest.fn(),
}));

import { GET } from "./route";
import { generateReminders } from "~/server/reminders/generate";
import { generateIssueAlerts } from "~/server/issues/alerts";
import { env } from "~/env";

const generateMock = generateReminders as jest.Mock;
const issueAlertsMock = generateIssueAlerts as jest.Mock;

function buildRequest(authorization?: string) {
  const headers: HeadersInit = authorization ? { authorization } : {};
  return new NextRequest("https://trackmyestate.app/api/cron/reminders", {
    headers,
  });
}

beforeEach(() => {
  generateMock.mockReset();
  issueAlertsMock
    .mockReset()
    .mockResolvedValue({ scanned: 0, queued: 0, failed: 0 });
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
    generateMock.mockResolvedValue({
      scanned: 12,
      queued: 3,
      failed: 0,
      hasMore: false,
    });

    const response = await GET(buildRequest("Bearer test-secret"));

    expect(generateMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      scanned: 12,
      queued: 3,
      failed: 0,
      hasMore: false,
      issues: { scanned: 0, queued: 0, failed: 0 },
    });
  });

  it("reports an issue alert that failed as a skipped record", async () => {
    generateMock.mockResolvedValue({
      scanned: 1,
      queued: 0,
      failed: 0,
      hasMore: false,
    });
    issueAlertsMock.mockResolvedValue({
      scanned: 2,
      queued: 1,
      failed: 1,
      firstError: "Issue issue-1: boom",
    });

    const response = await GET(buildRequest("Bearer test-secret"));

    await expect(response.json()).resolves.toMatchObject({
      failed: 1,
      firstError: "Issue issue-1: boom",
    });
  });
});
