/**
 * @jest-environment node
 *
 * End-to-end tests of the reminder pipeline: the real generator, enqueue,
 * drain, engine, email channel and template, running against an in-memory
 * database (`~/server/__testing__/memory-db`) with only the Resend API
 * mocked. Each test seeds a portfolio, runs the generator and the drain at
 * chosen times, and checks what would actually have been emailed.
 *
 * (`node` environment: the cron route tests need the Fetch API globals.)
 */
import { NextRequest } from "next/server";

import { db, resetMemoryDb, rows } from "~/server/__testing__/memory-db";
import { stopGuestReminders } from "~/server/actions/guest-opt-out";
import { signGuestOptOut } from "~/server/guests/opt-out";
import { processDueNotificationJobs } from "~/server/notifications/process";
import { BATCH_SIZE as GENERATOR_BATCH, generateReminders } from "./generate";

jest.mock("~/server/db", () =>
  jest.requireActual<Record<string, unknown>>("~/server/__testing__/memory-db"),
);
jest.mock("~/env", () => ({
  env: {
    NODE_ENV: "test",
    RESEND_API_KEY: "re_test",
    NOTIFICATIONS_EMAIL_FROM: "notifications@trackmyestate.app",
    NEXT_PUBLIC_SITE_URL: "https://trackmyestate.app",
    BETTER_AUTH_SECRET: "test-secret",
    CRON_SECRET: "cron-secret",
  },
}));
const mockSend = jest.fn();
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}));
jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

// ---------------------------------------------------------------------------
// Time: 5 Oct 2026. India is UTC+5:30, so 09:00 IST = 03:30 UTC.
// ---------------------------------------------------------------------------
const EARLY_MORNING = new Date("2026-10-05T01:00:00Z"); // 06:30 IST
const BEFORE_NINE = new Date("2026-10-05T03:00:00Z"); // 08:30 IST
const NINE_IST = new Date("2026-10-05T03:30:00Z");
const AFTER_NINE = new Date("2026-10-05T03:31:00Z"); // 09:01 IST

/** Due date 2026-10-DD, stored the app's way: midnight UTC (see calendar-day). */
function dueOct(day: number) {
  return new Date(Date.UTC(2026, 9, day));
}

function at(time: Date) {
  jest.setSystemTime(time);
  return time;
}

type Seeded = Awaited<ReturnType<typeof seedPortfolio>>;

/**
 * Ananya (India) with a property, a utility schedule with two extra
 * recipients, and bills chosen to hit — or deliberately miss — the default
 * schedules on 5 Oct:
 *
 * | bill    | due     | offset | default schedule hit?          |
 * |---------|---------|--------|--------------------------------|
 * | util    | 8 Oct   | -3     | utility [-3, 0, +3] ✓          |
 * | emi     | 5 Oct   | 0      | EMI [-3, 0] ✓                  |
 * | premium | 4 Oct   | +1     | premium [-30, -7, -1, +1] ✓    |
 * | rent    | 5 Oct   | 0      | rent [0, +3] ✓ (incoming)      |
 * | paid    | 8 Oct   | -3     | ✗ already paid                 |
 * | farEmi  | 15 Oct  | -10    | ✗ no reminder that day         |
 * | deleted | 8 Oct   | -3     | ✗ soft-deleted                 |
 */
async function seedPortfolio(
  owner: { timezone?: string; reminderHour?: number; email?: string } = {},
) {
  const user = await db.user.create({
    data: {
      name: "Ananya Rao",
      email: owner.email ?? "ananya@example.in",
      ...(owner.timezone ? { timezone: owner.timezone } : {}),
      ...(owner.reminderHour !== undefined
        ? { reminderHour: owner.reminderHour }
        : {}),
    } as never,
  });
  const property = await db.property.create({
    data: { ownerId: user.id, name: "Indiranagar 2BHK" } as never,
  });
  const schedule = await db.billSchedule.create({
    data: {
      ownerId: user.id,
      category: "UTILITY_BILL",
      propertyId: property.id,
      recipients: [
        { name: "Spouse", email: "spouse@example.in", notifyOnDue: true },
        { name: "CA", email: "ca@example.in", notifyOnDue: false },
      ],
    } as never,
  });

  const bill = (data: Record<string, unknown>) =>
    db.bill.create({
      data: {
        ownerId: user.id,
        status: "DUE",
        direction: "OUTFLOW",
        ...data,
      } as never,
    });

  const util = await bill({
    category: "UTILITY_BILL",
    billScheduleId: schedule.id,
    propertyId: property.id,
    description: "BESCOM electricity",
    amount: 4120,
    dueDate: dueOct(8),
  });
  const emi = await bill({
    category: "EMI",
    loanId: "loan-1",
    description: "Home loan EMI - SBI",
    amount: 71250,
    dueDate: dueOct(5),
  });
  const premium = await bill({
    category: "PREMIUM",
    policyId: "policy-1",
    description: "LIC Jeevan Anand",
    amount: 42500,
    status: "OVERDUE",
    dueDate: dueOct(4),
  });
  const rent = await bill({
    category: "RENT",
    direction: "INFLOW",
    propertyId: property.id,
    leaseId: "lease-1",
    description: "Rent · Whitefield",
    amount: 32000,
    dueDate: dueOct(5),
  });
  const paid = await bill({
    category: "UTILITY_BILL",
    billScheduleId: schedule.id,
    propertyId: property.id,
    description: "Water",
    amount: 600,
    status: "PAID",
    dueDate: dueOct(8),
  });
  const farEmi = await bill({
    category: "EMI",
    loanId: "loan-2",
    description: "Car loan EMI",
    amount: 12000,
    dueDate: dueOct(15),
  });
  const deleted = await bill({
    category: "UTILITY_BILL",
    propertyId: property.id,
    description: "Old gas bill",
    amount: 900,
    dueDate: dueOct(8),
    deletedAt: new Date("2026-09-01T00:00:00Z"),
  });

  return {
    user,
    property,
    schedule,
    util,
    emi,
    premium,
    rent,
    paid,
    farEmi,
    deleted,
  };
}

function jobs() {
  return rows("notificationJob");
}
function jobsFor(billId: string) {
  return jobs().filter((job) => job.billId === billId);
}
function sentEmails() {
  return mockSend.mock.calls.map(
    ([email]) =>
      email as { to: string; subject: string; html: string; text: string },
  );
}
async function addGuest(seeded: Seeded, data: Record<string, unknown> = {}) {
  return db.guest.create({
    data: {
      ownerId: seeded.user.id,
      name: "Radha Rao",
      email: "radha@example.in",
      channels: ["EMAIL"],
      categories: ["UTILITY_BILL"],
      propertyIds: [],
      dueDayOnly: false,
      ...data,
    } as never,
  });
}

beforeAll(() => {
  jest.useFakeTimers({
    now: EARLY_MORNING,
    doNotFake: ["nextTick", "queueMicrotask", "setImmediate", "setTimeout"],
  });
});
afterAll(() => {
  jest.useRealTimers();
});
beforeEach(() => {
  resetMemoryDb();
  mockSend.mockReset().mockResolvedValue({ data: { id: "msg" }, error: null });
  at(EARLY_MORNING);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
  jest.spyOn(console, "info").mockImplementation(() => undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------

describe("generating reminders", () => {
  it("queues exactly the reminders due today, for 9 am local time", async () => {
    const s = await seedPortfolio();

    const summary = await generateReminders(at(EARLY_MORNING));

    // Owner: util, emi, premium, rent. Utility recipient who wants due
    // reminders: spouse (the CA opted out of due reminders).
    expect(summary.queued).toBe(5);
    expect(
      jobs()
        .map((j) => j.recipient)
        .sort(),
    ).toEqual(
      [
        "ananya@example.in",
        "ananya@example.in",
        "ananya@example.in",
        "ananya@example.in",
        "spouse@example.in",
      ].sort(),
    );
    for (const id of [s.paid.id, s.farEmi.id, s.deleted.id]) {
      expect(jobsFor(id)).toHaveLength(0);
    }
    for (const job of jobs()) {
      expect(job).toMatchObject({ status: "SCHEDULED", channel: "EMAIL" });
      expect(job.scheduledFor).toEqual(NINE_IST);
    }
  });

  it("words each reminder for its offset and direction", async () => {
    const s = await seedPortfolio();
    await generateReminders(at(EARLY_MORNING));

    const title = (billId: string) =>
      jobsFor(billId).find((j) => j.recipient === "ananya@example.in")?.title;
    expect(title(s.util.id)).toBe("BESCOM electricity: ₹4,120 due in 3 days");
    expect(title(s.emi.id)).toBe("Home loan EMI - SBI: ₹71,250 due today");
    expect(title(s.premium.id)).toBe(
      "LIC Jeevan Anand: ₹42,500 is 1 day overdue",
    );
    expect(title(s.rent.id)).toBe("Rent · Whitefield: ₹32,000 expected today");
  });

  it("is idempotent: hourly re-runs queue nothing new", async () => {
    await seedPortfolio();
    await generateReminders(at(EARLY_MORNING));

    const again = await generateReminders(
      at(new Date(EARLY_MORNING.getTime() + 60 * 60 * 1000)),
    );

    expect(again.queued).toBe(0);
    expect(jobs()).toHaveLength(5);
  });

  it("follows a customised schedule and respects a turned-off kind", async () => {
    const s = await seedPortfolio();
    // Utility bills: only a week before (so not -3). EMIs: turned off.
    await db.notificationRule.create({
      data: {
        ownerId: s.user.id,
        category: "UTILITY_BILL",
        anchor: "DUE_DATE",
        offsetDays: -7,
        channels: ["EMAIL"],
        active: true,
      } as never,
    });
    await db.notificationRule.create({
      data: {
        ownerId: s.user.id,
        category: "EMI",
        anchor: "DUE_DATE",
        offsetDays: 0,
        channels: ["EMAIL"],
        active: false,
      } as never,
    });

    await generateReminders(at(EARLY_MORNING));

    expect(jobsFor(s.util.id)).toHaveLength(0);
    expect(jobsFor(s.emi.id)).toHaveLength(0);
    expect(jobsFor(s.premium.id)).toHaveLength(1);
  });

  it("ignores another owner's customised rules", async () => {
    const s = await seedPortfolio();
    await db.notificationRule.create({
      data: {
        ownerId: "someone-else",
        category: "EMI",
        anchor: "DUE_DATE",
        offsetDays: -7,
        channels: ["EMAIL"],
        active: true,
      } as never,
    });

    await generateReminders(at(EARLY_MORNING));

    expect(jobsFor(s.emi.id)).toHaveLength(1);
  });

  it("counts days and schedules the send in the owner's own time zone", async () => {
    const s = await seedPortfolio({
      timezone: "America/New_York",
      reminderHour: 18,
    });
    // 13:00 UTC on 5 Oct = 09:00 in New York (UTC-4 in October).
    const nyMorning = at(new Date("2026-10-05T13:00:00Z"));
    // A bill due 8 Oct.
    const nyBill = await db.bill.create({
      data: {
        ownerId: s.user.id,
        category: "EMI",
        status: "DUE",
        direction: "OUTFLOW",
        description: "NY EMI",
        amount: 500,
        dueDate: new Date("2026-10-08"),
      } as never,
    });

    await generateReminders(nyMorning);

    const [job] = jobsFor(nyBill.id);
    expect(job?.title).toBe("NY EMI: ₹500 due in 3 days");
    // 18:00 in New York on 5 Oct.
    expect(job?.scheduledFor).toEqual(new Date("2026-10-05T22:00:00Z"));
  });

  it("pages through many bills without missing or repeating any", async () => {
    const s = await seedPortfolio();
    const extra = GENERATOR_BATCH * 2 + 37;
    for (let i = 0; i < extra; i++) {
      await db.bill.create({
        data: {
          ownerId: s.user.id,
          category: "EMI",
          status: "DUE",
          direction: "OUTFLOW",
          description: `EMI ${i}`,
          amount: 1000,
          dueDate: dueOct(5),
        } as never,
      });
    }

    const summary = await generateReminders(at(EARLY_MORNING));

    expect(summary.hasMore).toBe(false);
    expect(summary.queued).toBe(5 + extra);
    const keys = jobs().map((j) => j.idempotencyKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("sending reminders", () => {
  it("sends nothing before the send time, everything after it", async () => {
    await seedPortfolio();
    await generateReminders(at(EARLY_MORNING));

    const early = await processDueNotificationJobs(at(BEFORE_NINE));
    expect(early.total).toBe(0);
    expect(mockSend).not.toHaveBeenCalled();

    const due = await processDueNotificationJobs(at(AFTER_NINE));
    expect(due.outcomes.SENT).toBe(5);
    expect(mockSend).toHaveBeenCalledTimes(5);
    for (const job of jobs()) {
      expect(job.status).toBe("SENT");
      expect(job.sentAt).toBeInstanceOf(Date);
    }
  });

  it("gives the owner a link into the app, and other recipients only the essentials", async () => {
    const s = await seedPortfolio();
    await generateReminders(at(EARLY_MORNING));
    await processDueNotificationJobs(at(AFTER_NINE));

    const toOwner = sentEmails().find(
      (e) => e.to === "ananya@example.in" && e.subject.startsWith("BESCOM"),
    )!;
    expect(toOwner.html).toContain(
      `https://trackmyestate.app/properties/${s.property.id}/utilities/bills/${s.util.id}`,
    );
    expect(toOwner.text).toContain("Mark it paid");

    const toSpouse = sentEmails().find((e) => e.to === "spouse@example.in")!;
    expect(toSpouse.subject).toBe("BESCOM electricity: ₹4,120 due in 3 days");
    expect(toSpouse.text).toContain("From Ananya Rao, via TrackMyEstate.");
    expect(toSpouse.text).not.toContain("Mark it paid");
    expect(toSpouse.html).not.toContain("<a ");
  });

  it("stops when paid: a bill settled after queuing isn't reminded", async () => {
    const s = await seedPortfolio();
    await generateReminders(at(EARLY_MORNING));
    await db.bill.update({
      where: { id: s.emi.id },
      data: { status: "PAID" } as never,
    });

    const summary = await processDueNotificationJobs(at(AFTER_NINE));

    expect(summary.outcomes.CANCELLED).toBe(1);
    expect(jobsFor(s.emi.id)[0]).toMatchObject({
      status: "CANCELLED",
      failedReason: "Bill is paid",
    });
    expect(sentEmails().some((e) => e.subject.startsWith("Home loan"))).toBe(
      false,
    );
  });

  it("retries a temporary failure with backoff, then sends", async () => {
    const s = await seedPortfolio();
    await db.bill.deleteMany({ where: { id: { notIn: [s.emi.id] } } });
    await generateReminders(at(EARLY_MORNING));
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { statusCode: 503, message: "Service unavailable" },
    });

    const first = await processDueNotificationJobs(at(AFTER_NINE));
    expect(first.outcomes.RETRY_SCHEDULED).toBe(1);
    const [job] = jobs();
    expect(job).toMatchObject({ status: "SCHEDULED", retryCount: 1 });
    expect(job!.scheduledFor).toEqual(
      new Date(AFTER_NINE.getTime() + 5 * 60 * 1000),
    );

    // Not yet: the retry is 5 minutes out.
    const tooSoon = await processDueNotificationJobs(
      at(new Date(AFTER_NINE.getTime() + 2 * 60 * 1000)),
    );
    expect(tooSoon.total).toBe(0);

    const retried = await processDueNotificationJobs(
      at(new Date(AFTER_NINE.getTime() + 6 * 60 * 1000)),
    );
    expect(retried.outcomes.SENT).toBe(1);
    expect(jobs()[0]!.status).toBe("SENT");
  });

  it("fails a permanent error straight away", async () => {
    const s = await seedPortfolio();
    await db.bill.deleteMany({ where: { id: { notIn: [s.emi.id] } } });
    await generateReminders(at(EARLY_MORNING));
    mockSend.mockResolvedValue({
      data: null,
      error: { statusCode: 422, message: "Invalid recipient" },
    });

    const summary = await processDueNotificationJobs(at(AFTER_NINE));

    expect(summary.outcomes.FAILED).toBe(1);
    expect(jobs()[0]).toMatchObject({
      status: "FAILED",
      failedReason: "Invalid recipient",
    });
  });

  it("gives up after 3 attempts", async () => {
    const s = await seedPortfolio();
    await db.bill.deleteMany({ where: { id: { notIn: [s.emi.id] } } });
    await generateReminders(at(EARLY_MORNING));
    mockSend.mockResolvedValue({
      data: null,
      error: { statusCode: 500, message: "Boom" },
    });

    let time = AFTER_NINE.getTime();
    for (let i = 0; i < 5; i++) {
      await processDueNotificationJobs(at(new Date(time)));
      time += 60 * 60 * 1000; // an hour later — past any backoff
    }

    expect(mockSend).toHaveBeenCalledTimes(3);
    expect(jobs()[0]).toMatchObject({ status: "FAILED", retryCount: 3 });
  });

  it("recovers a job a crashed run left mid-send", async () => {
    const s = await seedPortfolio();
    await db.bill.deleteMany({ where: { id: { notIn: [s.emi.id] } } });
    await generateReminders(at(EARLY_MORNING));
    // A run claims the job at 09:01 and dies before sending.
    at(AFTER_NINE);
    await db.notificationJob.updateMany({
      where: {},
      data: { status: "PROCESSING" } as never,
    });

    const tooSoon = await processDueNotificationJobs(
      at(new Date(AFTER_NINE.getTime() + 5 * 60 * 1000)),
    );
    expect(tooSoon.reclaimed).toBe(0);

    const later = await processDueNotificationJobs(
      at(new Date(AFTER_NINE.getTime() + 15 * 60 * 1000)),
    );
    expect(later.reclaimed).toBe(1);
    expect(later.outcomes.SENT).toBe(1);
    expect(jobs()[0]).toMatchObject({ status: "SENT", retryCount: 1 });
  });

  it("keeps going when one job hits an unexpected error", async () => {
    const s = await seedPortfolio();
    await generateReminders(at(EARLY_MORNING));
    const realFindUnique = db.bill.findUnique.bind(db.bill);
    jest.spyOn(db.bill, "findUnique").mockImplementation((async (args: {
      where: { id: string };
    }) => {
      if (args.where.id === s.emi.id) throw new Error("database blip");
      return realFindUnique(args as never);
    }) as never);

    const summary = await processDueNotificationJobs(at(AFTER_NINE));

    expect(summary.outcomes.ERRORED).toBe(1);
    expect(summary.outcomes.SENT).toBe(4);
    // The errored job is retried once reclaimed.
    jest.restoreAllMocks();
    const later = await processDueNotificationJobs(
      at(new Date(AFTER_NINE.getTime() + 15 * 60 * 1000)),
    );
    expect(later.outcomes.SENT).toBe(1);
  });

  it("deletes finished jobs after 90 days, but never pending ones", async () => {
    const old = new Date("2026-06-01T00:00:00Z");
    await db.notificationJob.create({
      data: {
        ownerId: "u",
        idempotencyKey: "a",
        status: "SENT",
        scheduledFor: old,
      } as never,
    });
    await db.notificationJob.create({
      data: {
        ownerId: "u",
        idempotencyKey: "b",
        status: "CANCELLED",
        scheduledFor: old,
      } as never,
    });
    await db.notificationJob.create({
      data: {
        ownerId: "u",
        idempotencyKey: "c",
        status: "SENT",
        scheduledFor: new Date("2026-09-30T00:00:00Z"),
      } as never,
    });

    const summary = await processDueNotificationJobs(at(AFTER_NINE));

    expect(summary.purged).toBe(2);
    expect(jobs().map((j) => j.idempotencyKey)).toEqual(["c"]);
  });
});

describe("guests", () => {
  it("emails a matching guest in the owner's name, with a working stop link", async () => {
    const s = await seedPortfolio();
    const guest = await addGuest(s, { propertyIds: [s.property.id] });

    await generateReminders(at(EARLY_MORNING));
    await processDueNotificationJobs(at(AFTER_NINE));

    const email = sentEmails().find((e) => e.to === "radha@example.in")!;
    expect(email.subject).toBe("BESCOM electricity: ₹4,120 due in 3 days");
    expect(email.text).toContain("From Ananya Rao, via TrackMyEstate.");
    expect(email.text).not.toContain("Mark it paid");
    expect(email.html).toContain(">Stop these reminders</a>");
    const link = /Stop these reminders: (\S+)/.exec(email.text)?.[1];
    const url = new URL(link!);
    expect(url.pathname).toBe("/reminders/stop");
    expect(url.searchParams.get("guest")).toBe(guest.id);
    expect(url.searchParams.get("sig")).toBe(signGuestOptOut(guest.id));
  });

  it("only reminds guests about their kinds and properties", async () => {
    const s = await seedPortfolio();
    await addGuest(s, { email: "a@x.in", categories: ["RENT"] });
    await addGuest(s, {
      email: "b@x.in",
      propertyIds: ["000000000000000000000fff"],
    });
    await addGuest(s, { email: "c@x.in", categories: ["EMI", "PREMIUM"] });

    await generateReminders(at(EARLY_MORNING));

    const to = (address: string) =>
      jobs()
        .filter((j) => j.recipient === address)
        .map((j) => j.billId);
    expect(to("a@x.in")).toEqual([s.rent.id]);
    expect(to("b@x.in")).toEqual([]);
    expect(to("c@x.in").sort()).toEqual([s.emi.id, s.premium.id].sort());
  });

  it("skips paused and opted-out guests, and phone-only ones (no SMS yet)", async () => {
    const s = await seedPortfolio();
    await addGuest(s, { email: "paused@x.in", pausedAt: new Date() });
    await addGuest(s, { email: "out@x.in", optedOutAt: new Date() });
    await addGuest(s, { email: "gone@x.in", deletedAt: new Date() });
    await addGuest(s, {
      email: undefined,
      phone: "+919876543210",
      channels: ["WHATSAPP"],
    });

    await generateReminders(at(EARLY_MORNING));

    const recipients = jobs().map((j) => j.recipient);
    for (const skipped of ["paused@x.in", "out@x.in", "gone@x.in"]) {
      expect(recipients).not.toContain(skipped);
    }
    expect(recipients.every((r) => String(r).includes("@"))).toBe(true);
  });

  it("reminds a due-day-only guest only on the due day", async () => {
    const s = await seedPortfolio();
    await addGuest(s, {
      categories: ["UTILITY_BILL", "EMI"],
      dueDayOnly: true,
    });

    await generateReminders(at(EARLY_MORNING));

    const guestBills = jobs()
      .filter((j) => j.recipient === "radha@example.in")
      .map((j) => j.billId);
    // EMI is due today (offset 0); the utility is 3 days away.
    expect(guestBills).toEqual([s.emi.id]);
  });

  it("cancels a queued reminder if the guest stops before it's sent", async () => {
    const s = await seedPortfolio();
    const guest = await addGuest(s);
    await generateReminders(at(EARLY_MORNING));

    // The guest clicks the link in their welcome email at 08:30.
    at(BEFORE_NINE);
    await expect(
      stopGuestReminders(guest.id, signGuestOptOut(guest.id)),
    ).rejects.toThrow("REDIRECT:/reminders/stop");

    const summary = await processDueNotificationJobs(at(AFTER_NINE));

    const guestJob = jobs().find((j) => j.recipient === "radha@example.in")!;
    expect(guestJob).toMatchObject({
      status: "CANCELLED",
      failedReason: "Guest stopped reminders",
    });
    expect(summary.outcomes.CANCELLED).toBe(1);
    expect(sentEmails().some((e) => e.to === "radha@example.in")).toBe(false);
  });

  it("cancels a queued reminder if the owner pauses the guest", async () => {
    const s = await seedPortfolio();
    const guest = await addGuest(s);
    await generateReminders(at(EARLY_MORNING));
    await db.guest.update({
      where: { id: guest.id },
      data: { pausedAt: new Date() } as never,
    });

    await processDueNotificationJobs(at(AFTER_NINE));

    expect(
      jobs().find((j) => j.recipient === "radha@example.in"),
    ).toMatchObject({ status: "CANCELLED", failedReason: "Guest is paused" });
  });

  it("never emails the same address twice for one reminder", async () => {
    const s = await seedPortfolio();
    // A guest who is also the owner, and one who is also a utility recipient.
    await addGuest(s, { email: "Ananya@Example.in" });
    await addGuest(s, { email: "spouse@example.in" });

    await generateReminders(at(EARLY_MORNING));
    await processDueNotificationJobs(at(AFTER_NINE));

    const utilityEmails = sentEmails().filter((e) =>
      e.subject.startsWith("BESCOM"),
    );
    const addresses = utilityEmails.map((e) => e.to.toLowerCase());
    expect(addresses.sort()).toEqual([
      "ananya@example.in",
      "spouse@example.in",
    ]);
  });
});

describe("cron routes", () => {
  function request(path: string, secret = "cron-secret") {
    return new NextRequest(`https://trackmyestate.app${path}`, {
      headers: { authorization: `Bearer ${secret}` },
    });
  }

  it("runs the whole pipeline over HTTP: queue at 06:30, send at 09:01", async () => {
    const { GET: queueReminders } =
      await import("~/app/api/cron/reminders/route");
    const { GET: sendNotifications } =
      await import("~/app/api/cron/notifications/route");
    await seedPortfolio();

    at(EARLY_MORNING);
    const queued = await queueReminders(request("/api/cron/reminders"));
    expect(queued.status).toBe(200);
    await expect(queued.json()).resolves.toMatchObject({ queued: 5 });

    at(AFTER_NINE);
    const sent = await sendNotifications(request("/api/cron/notifications"));
    expect(sent.status).toBe(200);
    await expect(sent.json()).resolves.toMatchObject({
      total: 5,
      outcomes: { SENT: 5 },
    });
  });

  it("rejects calls without the cron secret", async () => {
    const { GET: queueReminders } =
      await import("~/app/api/cron/reminders/route");
    await seedPortfolio();

    const response = await queueReminders(
      request("/api/cron/reminders", "wrong"),
    );

    expect(response.status).toBe(401);
    expect(jobs()).toHaveLength(0);
  });
});
