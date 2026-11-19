/**
 * The schedule lifecycle against the in-memory database: what happens to
 * bills and queued reminders when a schedule is created, changed or
 * retired.
 */
import {
  db as memoryDb,
  resetMemoryDb,
  rows,
} from "~/server/__testing__/memory-db";
import {
  hasPaymentHistory,
  removeUnpaidBills,
  retireSchedules,
  saveSchedule,
  termsChanged,
  type ScheduleTerms,
  type ScheduleTx,
} from "./lifecycle";

jest.mock("~/server/db", () =>
  jest.requireActual<Record<string, unknown>>("~/server/__testing__/memory-db"),
);
jest.mock("~/server/queries/settings", () => ({
  getUserTimeZone: jest.fn(async () => "Asia/Kolkata"),
}));

// The memory db is a plain PrismaClient; the helpers take the extended one.
const db = memoryDb as unknown as ScheduleTx;

const TODAY = new Date("2026-10-05");
const TERMS: ScheduleTerms = {
  recurrence: "MONTHLY",
  startDate: new Date("2026-01-05"),
  dueDay: 5,
  defaultAmount: 2_500_000,
};

async function bill(scheduleId: string, dueDate: string, status = "DUE") {
  return db.bill.create({
    data: {
      ownerId: "user-1",
      billScheduleId: scheduleId,
      leaseId: "lease-1",
      category: "RENT",
      direction: "INFLOW",
      amount: 2_500_000,
      dueDate: new Date(dueDate),
      status,
      generationKey: `${scheduleId}:${dueDate}`,
    } as never,
  });
}

async function job(billId: string) {
  return db.notificationJob.create({
    data: { billId, idempotencyKey: `job:${billId}` } as never,
  });
}

const bills = () => rows("bill");
const live = () => bills().filter((b) => !b.deletedAt);

beforeEach(() => resetMemoryDb());

async function createRentSchedule(terms = TERMS) {
  return saveSchedule(db, {
    owner: { leaseId: "lease-1" },
    category: "RENT",
    data: { ownerId: "user-1", householdId: "hh-1", leaseId: "lease-1" },
    terms,
    today: TODAY,
  });
}

describe("saveSchedule", () => {
  it("creates the schedule the first time", async () => {
    const id = await createRentSchedule();

    expect(rows("billSchedule")).toEqual([
      expect.objectContaining({
        id,
        category: "RENT",
        leaseId: "lease-1",
        householdId: "hh-1",
        dueDay: 5,
        defaultAmount: 2_500_000,
        endDate: null,
        active: true,
      }),
    ]);
  });

  it("leaves bills alone when nothing about them changed", async () => {
    const id = await createRentSchedule();
    await bill(id, "2026-10-05");

    await expect(createRentSchedule()).resolves.toBe(id);
    expect(live()).toHaveLength(1);
  });

  it("removes upcoming unpaid bills when the terms change", async () => {
    const id = await createRentSchedule();
    const overdue = await bill(id, "2026-09-05", "OVERDUE");
    const paid = await bill(id, "2026-10-05", "PAID");
    const upcoming = await bill(id, "2026-11-05");
    await job(upcoming.id);

    await createRentSchedule({ ...TERMS, defaultAmount: 2_750_000 });

    expect(live().map((b) => b.id)).toEqual([overdue.id, paid.id]);
    const removed = bills().find((b) => b.id === upcoming.id)!;
    expect(removed.generationKey).toBe(`removed:${upcoming.id}`);
    expect(rows("notificationJob")[0]).toMatchObject({
      status: "CANCELLED",
      failedReason: "Bill was removed",
    });
    expect(rows("billSchedule")[0]).toMatchObject({
      defaultAmount: 2_750_000,
    });
  });

  it("reactivates a retired schedule", async () => {
    const id = await createRentSchedule();
    await retireSchedules(db, { leaseId: "lease-1" }, { from: TODAY });

    await createRentSchedule();

    expect(rows("billSchedule")[0]).toMatchObject({ id, active: true });
  });
});

describe("where billing starts (billFrom)", () => {
  it("bills an old schedule from today, a recent one from its start", async () => {
    // First due 5 Jan, added 5 Oct: last month's bill isn't shown as unpaid.
    await createRentSchedule();
    expect(rows("billSchedule")[0]).toMatchObject({ billFrom: TODAY });

    resetMemoryDb();
    // First due 20 Sep, two weeks before it was added: that bill is owed.
    await createRentSchedule({
      ...TERMS,
      startDate: new Date("2026-09-20"),
      dueDay: 20,
    });
    expect(rows("billSchedule")[0]).toMatchObject({ billFrom: null });
  });

  it("bills changed terms from today", async () => {
    await createRentSchedule({ ...TERMS, startDate: new Date("2026-09-20") });
    await createRentSchedule({ ...TERMS, dueDay: 25 });

    expect(rows("billSchedule")[0]).toMatchObject({
      dueDay: 25,
      billFrom: TODAY,
    });
  });
});

describe("retireSchedules", () => {
  it("stops the schedule and removes unpaid bills from the given day", async () => {
    const id = await createRentSchedule();
    const overdue = await bill(id, "2026-09-05", "OVERDUE");
    await bill(id, "2026-10-05");
    await bill(id, "2026-11-05");

    await expect(
      retireSchedules(db, { leaseId: "lease-1" }, { from: TODAY }),
    ).resolves.toBe(1);

    expect(rows("billSchedule")[0]).toMatchObject({ active: false });
    expect(rows("billSchedule")[0]!.deletedAt).toBeUndefined();
    expect(live().map((b) => b.id)).toEqual([overdue.id]);
  });

  it("removes every unpaid bill when the asset is deleted", async () => {
    const id = await createRentSchedule();
    await bill(id, "2026-09-05", "OVERDUE");
    const partPaid = await bill(id, "2026-08-05", "PARTIALLY_PAID");
    await bill(id, "2026-11-05");

    await retireSchedules(
      db,
      { leaseId: "lease-1" },
      { from: TODAY, remove: true },
    );

    expect(rows("billSchedule")[0]!.deletedAt).toBeInstanceOf(Date);
    expect(live().map((b) => b.id)).toEqual([partPaid.id]);
  });

  it("does nothing when there's no schedule", async () => {
    await expect(
      retireSchedules(db, { loanId: "none" }, { from: TODAY }),
    ).resolves.toBe(0);
  });
});

describe("removeUnpaidBills", () => {
  it("returns how many bills it removed", async () => {
    const id = await createRentSchedule();
    await bill(id, "2026-11-05");
    await bill(id, "2026-12-05");

    await expect(removeUnpaidBills(db, [id], TODAY)).resolves.toBe(2);
    await expect(removeUnpaidBills(db, [], TODAY)).resolves.toBe(0);
  });
});

describe("termsChanged", () => {
  const existing = {
    ...TERMS,
    dueMonth: null,
    endDate: null,
    tenureMonths: null,
  };

  it("is false for the same terms", () => {
    expect(
      termsChanged(existing, { ...TERMS, startDate: new Date("2026-01-05") }),
    ).toBe(false);
  });

  it.each([
    ["amount", { defaultAmount: 1 }],
    ["due day", { dueDay: 6 }],
    ["start", { startDate: new Date("2026-02-05") }],
    ["end", { endDate: new Date("2027-01-05") }],
    ["tenure", { tenureMonths: 12 }],
    ["recurrence", { recurrence: "YEARLY" as const }],
  ])("is true when the %s changes", (_name, change) => {
    expect(termsChanged(existing, { ...TERMS, ...change })).toBe(true);
  });
});

describe("hasPaymentHistory", () => {
  it("is true once any bill was paid or part-paid", async () => {
    const id = await createRentSchedule();
    await bill(id, "2026-09-05", "OVERDUE");
    await expect(hasPaymentHistory(db, { leaseId: "lease-1" })).resolves.toBe(
      false,
    );
    await bill(id, "2026-08-05", "PARTIALLY_PAID");
    await expect(hasPaymentHistory(db, { leaseId: "lease-1" })).resolves.toBe(
      true,
    );
  });
});
