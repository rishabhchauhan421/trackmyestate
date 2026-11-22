/**
 * Property issues and their dues, against the in-memory database: what
 * each action writes, and what it refuses.
 */
import { db, resetMemoryDb, rows } from "~/server/__testing__/memory-db";
import { getSession } from "~/server/better-auth/server";
import {
  addDues,
  addKeyDate,
  closeIssue,
  createIssue,
  deleteIssue,
  removeDue,
  setFreeholdAlerts,
  updateDue,
} from "./issues";

jest.mock("~/server/db", () =>
  jest.requireActual<Record<string, unknown>>("~/server/__testing__/memory-db"),
);
jest.mock("~/server/households", () =>
  jest.requireActual<Record<string, unknown>>(
    "~/server/__testing__/households-mock",
  ),
);
jest.mock("~/server/better-auth/server", () => ({ getSession: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

const getSessionMock = getSession as jest.Mock;
const day = (value: string) => new Date(`${value}T00:00:00Z`);

function form(fields: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      data.append(key, item);
    }
  }
  return data;
}

type Row = Record<string, unknown>;
const issues = () => rows("propertyIssue") as Row[];
const bills = () => rows("bill") as Row[];

let propertyId: string;

async function seedIssue(data: Row = {}) {
  const issue = await db.propertyIssue.create({
    data: {
      ownerId: "user-1",
      householdId: "household-1",
      propertyId,
      type: "DISPUTE",
      title: "Boundary dispute",
      openedOn: day("2026-06-01"),
      ...data,
    } as never,
  });
  return issue.id;
}

async function seedDue(issueId: string | undefined, data: Row = {}) {
  const bill = await db.bill.create({
    data: {
      ownerId: "user-1",
      householdId: "household-1",
      category: "PROPERTY_DUE",
      direction: "OUTFLOW",
      propertyId,
      propertyIssueId: issueId,
      dueDate: day("2027-03-15"),
      amount: 24_000_000,
      status: "DUE",
      description: "Conversion charges",
      ...data,
    } as never,
  });
  return bill.id;
}

beforeEach(async () => {
  resetMemoryDb();
  jest.useFakeTimers().setSystemTime(new Date("2026-11-22T06:00:00Z"));
  getSessionMock.mockReset().mockResolvedValue({
    user: { id: "user-1", name: "Ananya", email: "ananya@example.com" },
  });
  const property = await db.property.create({
    data: {
      ownerId: "user-1",
      householdId: "household-1",
      name: "Whitefield Flat",
      currency: "INR",
      ownershipType: "LEASEHOLD",
    } as never,
  });
  propertyId = property.id;
});

afterEach(() => {
  jest.useRealTimers();
});

describe("createIssue", () => {
  it("opens an issue on the property with its first key date", async () => {
    await expect(
      createIssue(
        form({
          propertyId,
          type: "DISPUTE",
          title: "Boundary dispute",
          counterparty: "R. Mehta",
          keyDateLabel: "Next hearing",
          keyDate: "2026-12-10",
        }),
      ),
    ).rejects.toThrow(/REDIRECT:\/properties\/.+\/issues\/.+/);

    expect(issues()).toHaveLength(1);
    expect(issues()[0]).toMatchObject({
      householdId: "household-1",
      propertyId,
      status: "OPEN",
      title: "Boundary dispute",
      counterparty: "R. Mehta",
      openedOn: day("2026-11-22"),
      keyDates: [
        { label: "Next hearing", date: day("2026-12-10"), done: false },
      ],
    });
  });

  it("refuses a property in another household", async () => {
    const other = await db.property.create({
      data: {
        ownerId: "user-9",
        householdId: "household-9",
        name: "Other",
      } as never,
    });

    await expect(
      createIssue(form({ propertyId: other.id, type: "OTHER", title: "X" })),
    ).rejects.toThrow("Property not found");
    expect(issues()).toHaveLength(0);
  });

  it("needs a type and a title", async () => {
    await expect(createIssue(form({ propertyId, title: "X" }))).rejects.toThrow(
      "Choose what kind of issue this is",
    );
    await expect(
      createIssue(form({ propertyId, type: "OTHER", title: " " })),
    ).rejects.toThrow("Give the issue a short title");
  });
});

describe("addKeyDate", () => {
  it("adds the next date and ticks the ones already passed", async () => {
    const issueId = await seedIssue({
      keyDates: [
        { id: "kd-1", label: "Hearing", date: day("2026-11-10"), done: false },
      ],
    });

    await expect(
      addKeyDate(issueId, form({ label: "Next hearing", date: "2027-01-15" })),
    ).rejects.toThrow(/REDIRECT/);

    expect(issues()[0]!.keyDates).toMatchObject([
      { id: "kd-1", done: true },
      { label: "Next hearing", date: day("2027-01-15"), done: false },
    ]);
  });
});

describe("addDues", () => {
  it("adds one payment as a bill under the issue", async () => {
    const issueId = await seedIssue();

    await expect(
      addDues(
        form({
          propertyId,
          issueId,
          label: "Conversion charges",
          direction: "OUTFLOW",
          mode: "single",
          amount: "240000",
          dueDate: "2027-03-15",
        }),
      ),
    ).rejects.toThrow(/REDIRECT/);

    expect(bills()).toHaveLength(1);
    expect(bills()[0]).toMatchObject({
      category: "PROPERTY_DUE",
      direction: "OUTFLOW",
      householdId: "household-1",
      propertyId,
      propertyIssueId: issueId,
      amount: 24_000_000,
      currency: "INR",
      dueDate: day("2027-03-15"),
      status: "DUE",
      description: "Conversion charges",
    });
  });

  it("turns an instalment plan into one numbered bill per instalment", async () => {
    await expect(
      addDues(
        form({
          propertyId,
          label: "Builder instalment",
          direction: "OUTFLOW",
          mode: "plan",
          total: "900000",
          count: "3",
          firstDueDate: "2026-12-10",
          interval: "QUARTERLY",
        }),
      ),
    ).rejects.toThrow(`REDIRECT:/properties/${propertyId}`);

    expect(
      bills().map((bill) => [bill.description, bill.amount, bill.dueDate]),
    ).toEqual([
      ["Builder instalment (1 of 3)", 30_000_000, day("2026-12-10")],
      ["Builder instalment (2 of 3)", 30_000_000, day("2027-03-10")],
      ["Builder instalment (3 of 3)", 30_000_000, day("2027-06-10")],
    ]);
  });

  it("saves the instalments as edited in the preview", async () => {
    await expect(
      addDues(
        form({
          propertyId,
          label: "Builder instalment",
          direction: "OUTFLOW",
          mode: "plan",
          total: "900000",
          count: "2",
          firstDueDate: "2026-12-10",
          interval: "QUARTERLY",
          instalmentAmount: ["100000", "800000"],
          instalmentDate: ["2026-12-10", "2027-04-01"],
        }),
      ),
    ).rejects.toThrow(/REDIRECT/);

    expect(bills().map((bill) => [bill.amount, bill.dueDate])).toEqual([
      [10_000_000, day("2026-12-10")],
      [80_000_000, day("2027-04-01")],
    ]);
  });

  it("refuses a closed issue, and a bad instalment row", async () => {
    const issueId = await seedIssue({ status: "RESOLVED" });
    const base = {
      propertyId,
      label: "Fee",
      direction: "OUTFLOW",
      mode: "single",
      amount: "100",
      dueDate: "2027-01-01",
    };

    await expect(addDues(form({ ...base, issueId }))).rejects.toThrow(
      "Reopen this issue to change it",
    );
    await expect(
      addDues(
        form({
          ...base,
          mode: "plan",
          total: "100",
          count: "2",
          firstDueDate: "2027-01-01",
          interval: "MONTHLY",
          instalmentAmount: ["50", "0"],
          instalmentDate: ["2027-01-01", "2027-02-01"],
        }),
      ),
    ).rejects.toThrow("Enter an amount greater than zero for instalment 2");
    expect(bills()).toHaveLength(0);
  });
});

describe("closeIssue", () => {
  async function seedQueuedAlert(issueId: string, billId?: string) {
    await db.notificationJob.create({
      data: {
        ownerId: "user-1",
        category: "PROPERTY_DUE",
        channel: "EMAIL",
        recipient: "ananya@example.com",
        title: "t",
        body: "b",
        scheduledFor: new Date(),
        idempotencyKey: `k:${issueId}:${billId ?? ""}`,
        ...(billId ? { billId } : { propertyIssueId: issueId }),
      },
    });
  }
  const jobStatuses = () =>
    (rows("notificationJob") as Row[]).map((job) => job.status);

  it("records the outcome and cancels the issue's queued alerts", async () => {
    const issueId = await seedIssue();
    const billId = await seedDue(issueId);
    await seedQueuedAlert(issueId);

    await expect(
      closeIssue(
        issueId,
        form({ result: "RESOLVED", outcome: "Settled out of court" }),
      ),
    ).rejects.toThrow(/REDIRECT/);

    expect(issues()[0]).toMatchObject({
      status: "RESOLVED",
      outcome: "Settled out of court",
      resolvedOn: day("2026-11-22"),
    });
    expect(jobStatuses()).toEqual(["CANCELLED"]);
    // Unticked: what's still owed stays owed.
    expect(
      bills().find((bill) => bill.id === billId)!.deletedAt,
    ).toBeUndefined();
  });

  it("removes unpaid dues when asked, keeping paid and part-paid ones", async () => {
    const issueId = await seedIssue();
    const unpaid = await seedDue(issueId);
    const paid = await seedDue(issueId, { status: "PAID" });
    const partPaid = await seedDue(issueId, { status: "PARTIALLY_PAID" });
    await seedQueuedAlert(issueId, unpaid);

    await expect(
      closeIssue(issueId, form({ result: "DROPPED", cancelUnpaid: "on" })),
    ).rejects.toThrow(/REDIRECT/);

    const removed = bills()
      .filter((bill) => bill.deletedAt)
      .map((bill) => bill.id);
    expect(removed).toEqual([unpaid]);
    expect(removed).not.toContain(paid);
    expect(removed).not.toContain(partPaid);
    expect(jobStatuses()).toEqual(["CANCELLED"]);
  });

  it("marks the property freehold when a conversion is resolved", async () => {
    await db.property.update({
      where: { id: propertyId },
      data: { freeholdAlertsSince: day("2026-01-01") },
    });
    const issueId = await seedIssue({ type: "FREEHOLD_CONVERSION" });

    await expect(
      closeIssue(issueId, form({ result: "RESOLVED", markFreehold: "on" })),
    ).rejects.toThrow(/REDIRECT/);

    expect(rows("property")[0]).toMatchObject({
      ownershipType: "FREEHOLD",
      freeholdAlertsSince: null,
    });
  });

  it("refuses an issue in another household", async () => {
    const issueId = await seedIssue({ householdId: "household-9" });

    await expect(
      closeIssue(issueId, form({ result: "RESOLVED" })),
    ).rejects.toThrow("Issue not found");
  });
});

describe("deleteIssue", () => {
  it("soft-deletes the issue and its unpaid dues", async () => {
    const issueId = await seedIssue();
    await seedDue(issueId);
    const paid = await seedDue(issueId, { status: "PAID" });

    await expect(deleteIssue(issueId)).rejects.toThrow(
      `REDIRECT:/properties/${propertyId}`,
    );

    expect(issues()[0]!.deletedAt).toBeInstanceOf(Date);
    expect(
      bills()
        .filter((bill) => !bill.deletedAt)
        .map((b) => b.id),
    ).toEqual([paid]);
  });
});

describe("updateDue and removeDue", () => {
  it("changes an unpaid due and cancels reminders for the old date", async () => {
    const billId = await seedDue(undefined, { status: "OVERDUE" });
    await db.notificationJob.create({
      data: {
        ownerId: "user-1",
        category: "PROPERTY_DUE",
        channel: "EMAIL",
        recipient: "ananya@example.com",
        title: "t",
        body: "b",
        scheduledFor: new Date(),
        idempotencyKey: "k",
        billId,
      },
    });

    await expect(
      updateDue(
        billId,
        form({
          label: "Charges (final)",
          amount: "250000",
          dueDate: "2027-04-30",
        }),
      ),
    ).rejects.toThrow(`REDIRECT:/bills/${billId}`);

    expect(bills()[0]).toMatchObject({
      description: "Charges (final)",
      amount: 25_000_000,
      dueDate: day("2027-04-30"),
      status: "DUE",
    });
    expect((rows("notificationJob") as Row[])[0]!.status).toBe("CANCELLED");
  });

  it("won't touch a paid due, or remove a part-paid one", async () => {
    const paid = await seedDue(undefined, { status: "PAID" });
    const partPaid = await seedDue(undefined, { status: "PARTIALLY_PAID" });

    await expect(removeDue(paid)).rejects.toThrow(
      "This payment is already closed",
    );
    await expect(removeDue(partPaid)).rejects.toThrow(
      "A part-paid payment can't be removed",
    );
  });

  it("only edits property dues, not other bills", async () => {
    const rent = await seedDue(undefined, { category: "RENT" });

    await expect(
      updateDue(rent, form({ label: "x", amount: "1", dueDate: "2027-01-01" })),
    ).rejects.toThrow("Payment not found");
  });
});

describe("setFreeholdAlerts", () => {
  it("switches check-ins on from today, and off again", async () => {
    await setFreeholdAlerts(propertyId, true);
    expect(rows("property")[0]!.freeholdAlertsSince).toEqual(day("2026-11-22"));

    await setFreeholdAlerts(propertyId, false);
    expect(rows("property")[0]!.freeholdAlertsSince).toBeNull();
  });

  it("is only for leasehold properties", async () => {
    await db.property.update({
      where: { id: propertyId },
      data: { ownershipType: "FREEHOLD" },
    });

    await expect(setFreeholdAlerts(propertyId, true)).rejects.toThrow(
      "Freehold reminders are for leasehold properties",
    );
  });
});
