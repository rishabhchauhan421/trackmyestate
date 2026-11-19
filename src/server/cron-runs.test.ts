/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";

import { db, resetMemoryDb, rows } from "~/server/__testing__/memory-db";
import { cronRoute } from "./cron-route";
import { cronHealth, recordCronRun, sendHealth } from "./cron-runs";

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

describe("recordCronRun warnings", () => {
  it("notes records a successful run had to skip, until a clean run", async () => {
    await recordCronRun("bills", async () => ({
      failed: 2,
      firstError: "Schedule s1: bad data",
    }));
    expect(
      (await cronHealth(NOW)).find((j) => j.job === "bills"),
    ).toMatchObject({ lastWarning: "2 records failed: Schedule s1: bad data" });

    await recordCronRun("bills", async () => ({ failed: 0 }));
    expect(rows("cronRun")[0]).toMatchObject({ lastWarning: null });
  });
});

describe("sendHealth", () => {
  let n = 0;
  const job = (data: Record<string, unknown>) =>
    db.notificationJob.create({
      data: {
        scheduledFor: minutesAgo(5),
        idempotencyKey: `job:${n++}`,
        ...data,
      } as never,
    });

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ["nextTick", "setImmediate"] });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("is healthy when reminders go out and the odd one fails", async () => {
    for (let i = 0; i < 6; i++) await job({ status: "SENT" });
    await job({ status: "FAILED" });
    await job({ status: "SCHEDULED", scheduledFor: minutesAgo(10) });

    expect(await sendHealth(NOW)).toEqual({
      sent: 6,
      failed: 1,
      oldestDueMinutes: 0,
      stuck: false,
      failing: false,
    });
  });

  it("is failing when most reminders in the last day failed", async () => {
    for (let i = 0; i < 5; i++) await job({ status: "FAILED" });
    await job({ status: "SENT" });

    expect(await sendHealth(NOW)).toMatchObject({ failing: true });
  });

  it("is stuck when a due reminder has waited over an hour", async () => {
    jest.setSystemTime(minutesAgo(300));
    await job({ status: "SCHEDULED", scheduledFor: minutesAgo(90) });
    jest.setSystemTime(NOW);

    expect(await sendHealth(NOW)).toMatchObject({
      oldestDueMinutes: 90,
      stuck: true,
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
