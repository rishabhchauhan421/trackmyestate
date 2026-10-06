/**
 * @jest-environment node
 *
 * The bill generator end to end against the in-memory database, plus the
 * hand-off to reminders: generated bills are reminded about by the real
 * reminder generator.
 */
import { NextRequest } from "next/server";

import { db, resetMemoryDb, rows } from "~/server/__testing__/memory-db";
import { generateReminders } from "~/server/reminders/generate";
import {
  BATCH_SIZE,
  generateBills,
  generateBillsForSchedule,
  HORIZON_DAYS,
} from "./generate";

jest.mock("~/server/db", () =>
  jest.requireActual<Record<string, unknown>>("~/server/__testing__/memory-db"),
);
jest.mock("~/env", () => ({
  env: {
    NODE_ENV: "test",
    NEXT_PUBLIC_SITE_URL: "https://trackmyestate.app",
    BETTER_AUTH_SECRET: "test-secret",
    CRON_SECRET: "cron-secret",
  },
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
// Loaded via `generateBill`'s module; the generator itself needs no session.
jest.mock("~/server/better-auth/server", () => ({ getSession: jest.fn() }));

// 10:00 in India on 5 Oct 2026.
const NOW = new Date("2026-10-05T04:30:00Z");

async function owner(timezone?: string) {
  return db.user.create({
    data: {
      name: "Ananya Rao",
      email: `ananya${rows("user").length}@example.in`,
      ...(timezone ? { timezone } : {}),
    } as never,
  });
}

async function schedule(ownerId: string, data: Record<string, unknown>) {
  return db.billSchedule.create({
    data: { ownerId, recurrence: "MONTHLY", ...data } as never,
  });
}

const bills = () => rows("bill");
const dueDays = (scheduleId: string) =>
  bills()
    .filter((b) => b.billScheduleId === scheduleId)
    .map((b) => (b.dueDate as Date).toISOString().slice(0, 10))
    .sort();

beforeEach(() => resetMemoryDb());

describe("generateBills", () => {
  it("creates a utility's bills from 31 days ago to 35 days ahead", async () => {
    const user = await owner();
    const property = await db.property.create({
      data: { ownerId: user.id, name: "Indiranagar 2BHK" } as never,
    });
    const utility = await schedule(user.id, {
      category: "UTILITY_BILL",
      propertyId: property.id,
      billType: "ELECTRICITY",
      provider: "BESCOM",
      billingType: "VARIABLE",
      startDate: new Date("2026-01-10"),
      dueDay: 10,
      defaultAmount: 1500,
    });

    const summary = await generateBills(NOW);

    expect(summary).toEqual({
      schedulesScanned: 1,
      billsCreated: 2,
      skippedNoAmount: 0,
      hasMore: false,
    });
    // 4 Sep is outside the lookback; 10 Sep … 9 Nov is the window.
    expect(dueDays(utility.id)).toEqual(["2026-09-10", "2026-10-10"]);
    expect(bills()[0]).toMatchObject({
      ownerId: user.id,
      category: "UTILITY_BILL",
      direction: "OUTFLOW",
      propertyId: property.id,
      amount: 1500,
      status: "DUE",
      description: "BESCOM electricity · Indiranagar 2BHK",
    });
    // Stored as date-only values: midnight UTC.
    expect((bills()[0]!.dueDate as Date).toISOString()).toMatch(
      /T00:00:00.000Z$/,
    );
  });

  it("is idempotent: running again creates nothing", async () => {
    const user = await owner();
    await schedule(user.id, {
      category: "UTILITY_BILL",
      startDate: new Date("2026-01-10"),
      dueDay: 10,
      defaultAmount: 1500,
    });

    await generateBills(NOW);
    const again = await generateBills(NOW);

    expect(again.billsCreated).toBe(0);
    expect(bills()).toHaveLength(2);
  });

  it("doesn't duplicate a bill that already exists for that day", async () => {
    const user = await owner();
    const s = await schedule(user.id, {
      category: "UTILITY_BILL",
      startDate: new Date("2026-01-10"),
      dueDay: 10,
      defaultAmount: 1500,
    });
    await db.bill.create({
      data: {
        ownerId: user.id,
        billScheduleId: s.id,
        category: "UTILITY_BILL",
        dueDate: new Date("2026-10-10"),
        amount: 1720, // the real amount, entered by hand
        status: "DUE",
      } as never,
    });

    await generateBills(NOW);

    expect(dueDays(s.id)).toEqual(["2026-09-10", "2026-10-10"]);
    expect(bills().find((b) => b.amount === 1720)).toBeDefined();
  });

  it("numbers EMI instalments and names the lender", async () => {
    const user = await owner();
    const loan = await db.loan.create({
      data: { ownerId: user.id, lender: "SBI", type: "HOME_LOAN" } as never,
    });
    const emi = await schedule(user.id, {
      category: "EMI",
      loanId: loan.id,
      startDate: new Date("2020-01-05"),
      dueDay: 5,
      tenureMonths: 240,
      defaultAmount: 71250,
    });

    await generateBills(NOW);

    const emis = bills()
      .filter((b) => b.billScheduleId === emi.id)
      .sort(
        (a, b) => (a.dueDate as Date).getTime() - (b.dueDate as Date).getTime(),
      );
    expect(emis.map((b) => [b.installmentNumber, b.description])).toEqual([
      [81, "Loan EMI · SBI"],
      [82, "Loan EMI · SBI"],
      [83, "Loan EMI · SBI"],
    ]);
  });

  it("stops after an EMI's last instalment", async () => {
    const user = await owner();
    const emi = await schedule(user.id, {
      category: "EMI",
      startDate: new Date("2026-08-05"),
      dueDay: 5,
      tenureMonths: 2,
      defaultAmount: 5000,
    });

    await generateBills(NOW);

    // Instalments on 5 Aug and 5 Sep; 5 Sep is in the lookback, Aug isn't.
    expect(dueDays(emi.id)).toEqual(["2026-09-05"]);
  });

  it("marks rent and payouts as incoming", async () => {
    const user = await owner();
    const lease = await db.lease.create({
      data: { tenantName: "Karthik Subramaniam" } as never,
    });
    await schedule(user.id, {
      category: "RENT",
      leaseId: lease.id,
      startDate: new Date("2026-01-07"),
      dueDay: 7,
      defaultAmount: 32000,
    });

    await generateBills(NOW);

    expect(bills()[0]).toMatchObject({
      direction: "INFLOW",
      description: "Rent · Karthik Subramaniam",
    });
  });

  it("skips inactive, deleted and amount-less schedules", async () => {
    const user = await owner();
    const base = {
      category: "UTILITY_BILL",
      startDate: new Date("2026-01-10"),
      dueDay: 10,
    };
    await schedule(user.id, { ...base, defaultAmount: 100, active: false });
    await schedule(user.id, {
      ...base,
      defaultAmount: 100,
      deletedAt: new Date(),
    });
    await schedule(user.id, { ...base });

    const summary = await generateBills(NOW);

    expect(summary).toMatchObject({ schedulesScanned: 1, skippedNoAmount: 1 });
    expect(bills()).toHaveLength(0);
  });

  it("uses each owner's own 'today' for the window", async () => {
    // 20:00 UTC on 4 Nov: already 5 Nov in India, still 4 Nov in New York.
    const evening = new Date("2026-11-04T20:00:00Z");
    const india = await owner("Asia/Kolkata");
    const newYork = await owner("America/New_York");
    // Due on the 10th; the window's far end is today + 35 days.
    const sIndia = await schedule(india.id, {
      category: "UTILITY_BILL",
      startDate: new Date("2026-12-10"),
      dueDay: 10,
      defaultAmount: 1,
    });
    const sNewYork = await schedule(newYork.id, {
      category: "UTILITY_BILL",
      startDate: new Date("2026-12-10"),
      dueDay: 10,
      defaultAmount: 1,
    });

    await generateBills(evening);

    // India: 5 Nov + 35 = 10 Dec → included. New York: 4 Nov + 35 = 9 Dec.
    expect(dueDays(sIndia.id)).toEqual(["2026-12-10"]);
    expect(dueDays(sNewYork.id)).toEqual([]);
    expect(HORIZON_DAYS).toBe(35);
  });

  it("pages through many schedules", async () => {
    const user = await owner();
    for (let i = 0; i < BATCH_SIZE + 25; i++) {
      await schedule(user.id, {
        category: "UTILITY_BILL",
        startDate: new Date("2026-10-10"),
        dueDay: 10,
        defaultAmount: 1,
      });
    }

    const summary = await generateBills(NOW);

    expect(summary).toMatchObject({
      schedulesScanned: BATCH_SIZE + 25,
      billsCreated: BATCH_SIZE + 25,
      hasMore: false,
    });
  });
});

describe("generateBillsForSchedule", () => {
  it("generates just that schedule's bills", async () => {
    const user = await owner();
    const a = await schedule(user.id, {
      category: "UTILITY_BILL",
      startDate: new Date("2026-10-20"),
      dueDay: 20,
      defaultAmount: 900,
    });
    const b = await schedule(user.id, {
      category: "UTILITY_BILL",
      startDate: new Date("2026-10-20"),
      dueDay: 20,
      defaultAmount: 900,
    });

    const result = await generateBillsForSchedule(a.id, NOW);

    expect(result.billsCreated).toBe(1);
    expect(dueDays(a.id)).toEqual(["2026-10-20"]);
    expect(dueDays(b.id)).toEqual([]);
  });
});

describe("bills → reminders", () => {
  it("reminds about a generated bill on the default schedule", async () => {
    const user = await owner();
    await schedule(user.id, {
      category: "UTILITY_BILL",
      provider: "BESCOM",
      billType: "ELECTRICITY",
      // Due 8 Oct: 3 days from 5 Oct — a default utility reminder.
      startDate: new Date("2026-10-08"),
      dueDay: 8,
      defaultAmount: 4120,
    });

    await generateBills(NOW);
    const reminders = await generateReminders(NOW);

    expect(reminders.queued).toBe(1);
    expect(rows("notificationJob")[0]).toMatchObject({
      recipient: user.email,
      title: "BESCOM electricity: ₹4,120 due in 3 days",
    });
  });
});

describe("/api/cron/bills", () => {
  it("runs the generator for a request with the cron secret", async () => {
    const { GET } = await import("~/app/api/cron/bills/route");
    const user = await owner();
    await schedule(user.id, {
      category: "UTILITY_BILL",
      startDate: new Date(Date.now() + 5 * 86_400_000),
      dueDay: 1,
      defaultAmount: 1,
    });

    const ok = await GET(
      new NextRequest("https://trackmyestate.app/api/cron/bills", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    expect(ok.status).toBe(200);
    await expect(ok.json()).resolves.toMatchObject({ schedulesScanned: 1 });

    const denied = await GET(
      new NextRequest("https://trackmyestate.app/api/cron/bills", {
        headers: { authorization: "Bearer wrong" },
      }),
    );
    expect(denied.status).toBe(401);
  });
});

describe("/api/cron/daily", () => {
  it("generates bills, queues reminders and sends them in one run", async () => {
    jest.useFakeTimers({
      // 09:00 in India: the default send time, when the daily cron runs.
      now: new Date("2026-10-05T03:30:00Z"),
      doNotFake: ["nextTick", "queueMicrotask", "setImmediate", "setTimeout"],
    });
    const { GET } = await import("~/app/api/cron/daily/route");
    const user = await owner();
    await schedule(user.id, {
      category: "UTILITY_BILL",
      provider: "BESCOM",
      billType: "ELECTRICITY",
      startDate: new Date("2026-10-08"), // 3 days away: a default reminder
      dueDay: 8,
      defaultAmount: 4120,
    });

    const response = await GET(
      new NextRequest("https://trackmyestate.app/api/cron/daily", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      bills: { billsCreated: number };
      reminders: { queued: number };
      notifications: { total: number };
    };
    // 8 Oct and 8 Nov both fall within the 35-day horizon.
    expect(body.bills.billsCreated).toBe(2);
    expect(body.reminders.queued).toBe(1);
    // Queued for 09:00 today — due now, so sent in the same run (email
    // goes through the channel, which has no API key here and fails fast).
    expect(body.notifications.total).toBe(1);
    expect(rows("notificationJob")[0]!.status).not.toBe("SCHEDULED");
    jest.useRealTimers();
  });

  it("rejects a request without the cron secret", async () => {
    const { GET } = await import("~/app/api/cron/daily/route");
    const response = await GET(
      new NextRequest("https://trackmyestate.app/api/cron/daily"),
    );
    expect(response.status).toBe(401);
  });
});
