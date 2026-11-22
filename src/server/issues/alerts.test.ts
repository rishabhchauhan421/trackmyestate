/**
 * @jest-environment node
 *
 * The issue alert generator against the in-memory database, and through
 * the real drain, with only the Resend API mocked: what would be emailed
 * about a property's issues, to whom, and when it stops.
 */
import { db, resetMemoryDb, rows } from "~/server/__testing__/memory-db";
import { processDueNotificationJobs } from "~/server/notifications/process";
import { generateIssueAlerts } from "./alerts";

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
  },
}));
const mockSend = jest.fn();
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}));

// India is UTC+5:30, so 09:00 IST = 03:30 UTC.
const morning = (day: string) => new Date(`${day}T01:00:00Z`); // 06:30 IST
const afterNine = (day: string) => new Date(`${day}T03:31:00Z`);
const day = (value: string) => new Date(`${value}T00:00:00Z`);

async function seed({
  keyDates = [
    { id: "kd-1", label: "Next hearing", date: day("2026-11-30"), done: false },
  ],
  lastActivityAt = new Date("2026-11-20T10:00:00Z"),
}: {
  keyDates?: { id: string; label: string; date: Date; done: boolean }[];
  lastActivityAt?: Date;
} = {}) {
  const owner = await db.user.create({
    data: { name: "Ananya", email: "ananya@example.com" },
  });
  const spouse = await db.user.create({
    data: { name: "Dev", email: "dev@example.com" },
  });
  await db.householdMember.create({
    data: { householdId: "household-1", userId: owner.id, role: "OWNER" },
  });
  await db.householdMember.create({
    data: { householdId: "household-1", userId: spouse.id, role: "MEMBER" },
  });
  const property = await db.property.create({
    data: {
      ownerId: owner.id,
      householdId: "household-1",
      name: "Whitefield Flat",
      ownershipType: "LEASEHOLD",
    } as never,
  });
  const issue = await db.propertyIssue.create({
    data: {
      ownerId: owner.id,
      householdId: "household-1",
      propertyId: property.id,
      type: "DISPUTE",
      title: "Boundary dispute",
      openedOn: day("2026-06-01"),
      keyDates,
      lastActivityAt,
    },
  });
  return { owner, spouse, property, issue };
}

const jobs = () =>
  rows("notificationJob") as {
    recipient: string;
    title: string;
    status: string;
    scheduledFor: Date;
    propertyIssueId?: string;
    metadata?: { actionUrl?: string };
  }[];

beforeEach(() => {
  resetMemoryDb();
  jest.useFakeTimers();
  mockSend.mockReset().mockResolvedValue({ data: { id: "email-1" } });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("generateIssueAlerts", () => {
  it("emails the owner and the household a week before a key date, at 9 am their time", async () => {
    const { issue } = await seed();

    const summary = await generateIssueAlerts(morning("2026-11-23"));

    expect(summary).toMatchObject({ scanned: 1, queued: 2, failed: 0 });
    expect(
      jobs()
        .map((job) => job.recipient)
        .sort(),
    ).toEqual(["ananya@example.com", "dev@example.com"]);
    expect(jobs()[0]).toMatchObject({
      title: "Boundary dispute (Whitefield Flat): Next hearing in 7 days",
      scheduledFor: new Date("2026-11-23T03:30:00Z"),
      propertyIssueId: issue.id,
    });
  });

  it("never queues the same alert twice, however often it runs", async () => {
    await seed();

    await generateIssueAlerts(morning("2026-11-23"));
    const again = await generateIssueAlerts(new Date("2026-11-23T05:00:00Z"));
    // The next day's run catches up yesterday's slot under the same key.
    const nextDay = await generateIssueAlerts(morning("2026-11-24"));

    expect(again.queued).toBe(0);
    expect(nextDay.queued).toBe(0);
    expect(jobs()).toHaveLength(2);
  });

  it("asks whether it's finalised the day after the date passes", async () => {
    const { issue, property } = await seed();

    await generateIssueAlerts(morning("2026-12-01"));

    expect(jobs()[0]).toMatchObject({
      title: "Boundary dispute (Whitefield Flat): is this finalised?",
    });
    expect(jobs()[0]!.metadata?.actionUrl).toBe(
      `https://trackmyestate.app/properties/${property.id}/issues/${issue.id}/resolve`,
    );
  });

  it("says nothing about a resolved issue", async () => {
    const { issue } = await seed();
    await db.propertyIssue.update({
      where: { id: issue.id },
      data: { status: "RESOLVED" },
    });

    const summary = await generateIssueAlerts(morning("2026-11-23"));

    expect(summary.queued).toBe(0);
  });

  it("flags an open issue that has gone quiet, unless a due is still unpaid", async () => {
    const { issue, owner, property } = await seed({
      keyDates: [],
      lastActivityAt: new Date("2026-08-01T10:00:00Z"),
    });

    await db.bill.create({
      data: {
        ownerId: owner.id,
        householdId: "household-1",
        category: "PROPERTY_DUE",
        direction: "OUTFLOW",
        propertyId: property.id,
        propertyIssueId: issue.id,
        dueDate: day("2027-03-01"),
        amount: 100_000,
        status: "DUE",
      },
    });
    expect((await generateIssueAlerts(morning("2026-10-30"))).queued).toBe(0);

    await db.bill.updateMany({ where: {}, data: { status: "PAID" } });
    await generateIssueAlerts(morning("2026-10-30"));

    expect(jobs()[0]!.title).toBe(
      "Boundary dispute (Whitefield Flat): still open, no update in 90 days",
    );
  });

  it("sends the freehold check-in every six months, only when switched on", async () => {
    const { property, issue } = await seed({ keyDates: [] });
    await db.propertyIssue.update({
      where: { id: issue.id },
      data: { status: "DROPPED" },
    });

    // Off: nothing.
    expect((await generateIssueAlerts(morning("2027-05-22"))).queued).toBe(0);

    await db.property.update({
      where: { id: property.id },
      data: { freeholdAlertsSince: day("2026-11-22") },
    });
    expect((await generateIssueAlerts(morning("2027-03-01"))).queued).toBe(0);
    await generateIssueAlerts(morning("2027-05-22"));

    expect(jobs()).toHaveLength(2);
    expect(jobs()[0]!.title).toBe(
      "Whitefield Flat: time to look at freehold conversion?",
    );
  });

  it("skips the freehold check-in while a conversion is being tracked", async () => {
    const { property, issue } = await seed({ keyDates: [] });
    await db.property.update({
      where: { id: property.id },
      data: { freeholdAlertsSince: day("2026-11-22") },
    });
    await db.propertyIssue.update({
      where: { id: issue.id },
      data: {
        type: "FREEHOLD_CONVERSION",
        lastActivityAt: new Date("2027-05-01T00:00:00Z"),
      },
    });

    expect((await generateIssueAlerts(morning("2027-05-22"))).queued).toBe(0);
  });
});

describe("sending issue alerts", () => {
  it("sends a queued alert once it's due", async () => {
    await seed();
    await generateIssueAlerts(morning("2026-11-23"));

    jest.setSystemTime(afterNine("2026-11-23"));
    const summary = await processDueNotificationJobs(afterNine("2026-11-23"));

    expect(summary.outcomes.SENT).toBe(2);
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

  it("cancels a queued alert when the issue was resolved in the meantime", async () => {
    const { issue } = await seed();
    await generateIssueAlerts(morning("2026-11-23"));
    await db.propertyIssue.update({
      where: { id: issue.id },
      data: { status: "RESOLVED" },
    });

    jest.setSystemTime(afterNine("2026-11-23"));
    const summary = await processDueNotificationJobs(afterNine("2026-11-23"));

    expect(summary.outcomes.CANCELLED).toBe(2);
    expect(mockSend).not.toHaveBeenCalled();
    expect(jobs().every((job) => job.status === "CANCELLED")).toBe(true);
  });
});
