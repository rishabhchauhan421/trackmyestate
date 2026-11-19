/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

import { db, resetMemoryDb, rows } from "~/server/__testing__/memory-db";
import { cronRoute } from "./cron-route";
import { cronHealth, recordCronRun } from "./cron-runs";

jest.mock("~/server/db", () =>
  jest.requireActual<Record<string, unknown>>("~/server/__testing__/memory-db"),
);
jest.mock("~/env", () => ({ env: { CRON_SECRET: "cron-secret" } }));

const NOW = new Date("2026-11-19T09:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

beforeEach(() => resetMemoryDb());

describe("recordCronRun", () => {
  it("records a success", async () => {
    await expect(recordCronRun("bills", async () => 42)).resolves.toBe(42);
    expect(rows("cronRun")).toEqual([
      expect.objectContaining({
        job: "bills",
        lastStartedAt: expect.any(Date) as Date,
        lastSucceededAt: expect.any(Date) as Date,
        lastError: null,
      }),
    ]);
  });

  it("records a failure and rethrows it", async () => {
    await expect(
      recordCronRun("reminders", () => Promise.reject(new Error("db down"))),
    ).rejects.toThrow("db down");
    expect(rows("cronRun")[0]).toMatchObject({
      job: "reminders",
      lastError: "db down",
      lastFailedAt: expect.any(Date) as Date,
    });
  });
});

describe("cronHealth", () => {
  it("flags a job that never ran or missed two runs", async () => {
    await db.cronRun.create({
      data: { job: "notifications", lastSucceededAt: minutesAgo(20) },
    });
    await db.cronRun.create({
      data: { job: "reminders", lastSucceededAt: minutesAgo(131) },
    });

    const health = await cronHealth(NOW);

    expect(health.map(({ job, late }) => [job, late])).toEqual([
      ["notifications", false],
      ["reminders", true],
      ["bills", true],
    ]);
  });
});

describe("cronRoute", () => {
  const handler = cronRoute("bills", async () => ({ billsCreated: 1 }));

  it("rejects a request without the cron secret", async () => {
    const response = await handler(
      new NextRequest("https://trackmyestate.app/api/cron/bills"),
    );
    expect(response.status).toBe(401);
    expect(rows("cronRun")).toHaveLength(0);
  });

  it("runs and records the job", async () => {
    const response = await handler(
      new NextRequest("https://trackmyestate.app/api/cron/bills", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    expect(await response.json()).toEqual({ billsCreated: 1 });
    expect(rows("cronRun")[0]).toMatchObject({ job: "bills" });
  });
});
