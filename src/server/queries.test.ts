import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../generated/prisma";
import { db } from "~/server/db";
import {
  getActiveUtilitiesForProperty,
  getDashboardData,
  getTimelineEvents,
  getUtilityBillsForProperty,
} from "~/server/queries";

jest.mock("~/server/db");

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;

const OWNER_ID = "owner-1";

function aggregateResult(sum: Record<string, number | null>) {
  return { _sum: sum } as never;
}

beforeEach(() => {
  mockReset(dbMock);
});

describe("getDashboardData", () => {
  it("computes net worth as property + investment value minus loan outstanding", async () => {
    dbMock.property.aggregate.mockResolvedValue(
      aggregateResult({ currentEstimatedValue: 10_000_000 }),
    );
    dbMock.investment.aggregate.mockResolvedValue(
      aggregateResult({ currentEstimatedValue: 2_000_000 }),
    );
    dbMock.loan.aggregate.mockResolvedValue(
      aggregateResult({ outstandingBalance: 3_000_000 }),
    );
    dbMock.policy.aggregate.mockResolvedValue(
      aggregateResult({ sumAssured: 1_500_000 }),
    );
    dbMock.financialEvent.aggregate
      .mockResolvedValueOnce(aggregateResult({ amount: 50_000 })) // outflows
      .mockResolvedValueOnce(aggregateResult({ amount: 20_000 })); // inflows
    dbMock.financialEvent.findMany.mockResolvedValue([]);

    const result = await getDashboardData(OWNER_ID);

    expect(result.netWorth).toBe(10_000_000 + 2_000_000 - 3_000_000);
    expect(result.totalCoverage).toBe(1_500_000);
    expect(result.upcomingOutflows).toBe(50_000);
    expect(result.expectedInflows).toBe(20_000);
    expect(result.attentionItems).toEqual([]);
  });

  it("treats missing aggregate sums (no rows) as zero", async () => {
    dbMock.property.aggregate.mockResolvedValue(
      aggregateResult({ currentEstimatedValue: null }),
    );
    dbMock.investment.aggregate.mockResolvedValue(
      aggregateResult({ currentEstimatedValue: null }),
    );
    dbMock.loan.aggregate.mockResolvedValue(
      aggregateResult({ outstandingBalance: null }),
    );
    dbMock.policy.aggregate.mockResolvedValue(
      aggregateResult({ sumAssured: null }),
    );
    dbMock.financialEvent.aggregate.mockResolvedValue(
      aggregateResult({ amount: null }),
    );
    dbMock.financialEvent.findMany.mockResolvedValue([]);

    const result = await getDashboardData(OWNER_ID);

    expect(result.netWorth).toBe(0);
    expect(result.totalCoverage).toBe(0);
    expect(result.upcomingOutflows).toBe(0);
    expect(result.expectedInflows).toBe(0);
  });

  it("allows net worth to go negative when liabilities exceed assets", async () => {
    dbMock.property.aggregate.mockResolvedValue(
      aggregateResult({ currentEstimatedValue: 500_000 }),
    );
    dbMock.investment.aggregate.mockResolvedValue(
      aggregateResult({ currentEstimatedValue: 0 }),
    );
    dbMock.loan.aggregate.mockResolvedValue(
      aggregateResult({ outstandingBalance: 2_000_000 }),
    );
    dbMock.policy.aggregate.mockResolvedValue(aggregateResult({ sumAssured: 0 }));
    dbMock.financialEvent.aggregate.mockResolvedValue(
      aggregateResult({ amount: 0 }),
    );
    dbMock.financialEvent.findMany.mockResolvedValue([]);

    const result = await getDashboardData(OWNER_ID);

    expect(result.netWorth).toBe(500_000 - 2_000_000);
    expect(result.netWorth).toBeLessThan(0);
  });

  it("queries attention items as overdue OR due-within-7-days, newest first, capped at 5", async () => {
    dbMock.property.aggregate.mockResolvedValue(
      aggregateResult({ currentEstimatedValue: 0 }),
    );
    dbMock.investment.aggregate.mockResolvedValue(
      aggregateResult({ currentEstimatedValue: 0 }),
    );
    dbMock.loan.aggregate.mockResolvedValue(
      aggregateResult({ outstandingBalance: 0 }),
    );
    dbMock.policy.aggregate.mockResolvedValue(aggregateResult({ sumAssured: 0 }));
    dbMock.financialEvent.aggregate.mockResolvedValue(
      aggregateResult({ amount: 0 }),
    );
    dbMock.financialEvent.findMany.mockResolvedValue([]);

    await getDashboardData(OWNER_ID);

    const call = dbMock.financialEvent.findMany.mock.calls[0]?.[0];
    expect(call?.where?.ownerId).toBe(OWNER_ID);
    expect(call?.where?.OR).toEqual([
      { status: "OVERDUE" },
      { status: "DUE", dueDate: { lte: expect.any(Date) as Date } },
    ]);
    expect(call?.orderBy).toEqual({ dueDate: "asc" });
    expect(call?.take).toBe(5);
  });

  it("returns whatever attentionItems the DB gives back, unmodified", async () => {
    dbMock.property.aggregate.mockResolvedValue(
      aggregateResult({ currentEstimatedValue: 0 }),
    );
    dbMock.investment.aggregate.mockResolvedValue(
      aggregateResult({ currentEstimatedValue: 0 }),
    );
    dbMock.loan.aggregate.mockResolvedValue(
      aggregateResult({ outstandingBalance: 0 }),
    );
    dbMock.policy.aggregate.mockResolvedValue(aggregateResult({ sumAssured: 0 }));
    dbMock.financialEvent.aggregate.mockResolvedValue(
      aggregateResult({ amount: 0 }),
    );
    const items = [
      { id: "e1", status: "OVERDUE" },
      { id: "e2", status: "DUE" },
    ];
    dbMock.financialEvent.findMany.mockResolvedValue(items as never);

    const result = await getDashboardData(OWNER_ID);

    expect(result.attentionItems).toBe(items);
  });

  it("scopes the upcoming-outflows aggregate to open OUTFLOW statuses", async () => {
    dbMock.property.aggregate.mockResolvedValue(
      aggregateResult({ currentEstimatedValue: 0 }),
    );
    dbMock.investment.aggregate.mockResolvedValue(
      aggregateResult({ currentEstimatedValue: 0 }),
    );
    dbMock.loan.aggregate.mockResolvedValue(
      aggregateResult({ outstandingBalance: 0 }),
    );
    dbMock.policy.aggregate.mockResolvedValue(aggregateResult({ sumAssured: 0 }));
    dbMock.financialEvent.aggregate.mockResolvedValue(
      aggregateResult({ amount: 0 }),
    );
    dbMock.financialEvent.findMany.mockResolvedValue([]);

    await getDashboardData(OWNER_ID);

    const outflowCallArgs = dbMock.financialEvent.aggregate.mock.calls[0]?.[0];
    expect(outflowCallArgs?.where).toMatchObject({
      ownerId: OWNER_ID,
      type: "OUTFLOW",
      status: { in: ["DUE", "OVERDUE", "PARTIALLY_PAID"] },
    });
  });
});

describe("getTimelineEvents", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 15)); // 15 Jun 2026
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("bounds a 'month' range to the current calendar month", async () => {
    dbMock.financialEvent.findMany.mockResolvedValue([]);

    await getTimelineEvents(OWNER_ID, "month", "all");

    const call = dbMock.financialEvent.findMany.mock.calls[0]?.[0];
    expect(call?.where?.dueDate).toEqual({
      gte: new Date(2026, 5, 1),
      lt: new Date(2026, 6, 1),
    });
  });

  it("bounds a 'quarter' range to the current calendar quarter", async () => {
    dbMock.financialEvent.findMany.mockResolvedValue([]);

    await getTimelineEvents(OWNER_ID, "quarter", "all");

    const call = dbMock.financialEvent.findMany.mock.calls[0]?.[0];
    // June (month index 5) falls in Q2: Apr(3)-Jun(5)
    expect(call?.where?.dueDate).toEqual({
      gte: new Date(2026, 3, 1),
      lt: new Date(2026, 6, 1),
    });
  });

  it("bounds a 'year' range to the current calendar year", async () => {
    dbMock.financialEvent.findMany.mockResolvedValue([]);

    await getTimelineEvents(OWNER_ID, "year", "all");

    const call = dbMock.financialEvent.findMany.mock.calls[0]?.[0];
    expect(call?.where?.dueDate).toEqual({
      gte: new Date(2026, 0, 1),
      lt: new Date(2027, 0, 1),
    });
  });

  it("rolls a Q4 quarter over into January of the next year", async () => {
    jest.setSystemTime(new Date(2026, 11, 20)); // 20 Dec 2026, Q4
    dbMock.financialEvent.findMany.mockResolvedValue([]);

    await getTimelineEvents(OWNER_ID, "quarter", "all");

    const call = dbMock.financialEvent.findMany.mock.calls[0]?.[0];
    expect(call?.where?.dueDate).toEqual({
      gte: new Date(2026, 9, 1), // 1 Oct 2026
      lt: new Date(2027, 0, 1), // 1 Jan 2027, not month index 12
    });
  });

  it("rolls a December 'month' range over into January of the next year", async () => {
    jest.setSystemTime(new Date(2026, 11, 31)); // 31 Dec 2026
    dbMock.financialEvent.findMany.mockResolvedValue([]);

    await getTimelineEvents(OWNER_ID, "month", "all");

    const call = dbMock.financialEvent.findMany.mock.calls[0]?.[0];
    expect(call?.where?.dueDate).toEqual({
      gte: new Date(2026, 11, 1),
      lt: new Date(2027, 0, 1),
    });
  });

  it("adds a type filter for 'inflow' and 'outflow' but not 'all'", async () => {
    dbMock.financialEvent.findMany.mockResolvedValue([]);

    await getTimelineEvents(OWNER_ID, "month", "inflow");
    expect(
      dbMock.financialEvent.findMany.mock.calls[0]?.[0]?.where,
    ).toMatchObject({ type: "INFLOW" });

    await getTimelineEvents(OWNER_ID, "month", "outflow");
    expect(
      dbMock.financialEvent.findMany.mock.calls[1]?.[0]?.where,
    ).toMatchObject({ type: "OUTFLOW" });

    await getTimelineEvents(OWNER_ID, "month", "all");
    expect(
      dbMock.financialEvent.findMany.mock.calls[2]?.[0]?.where,
    ).not.toHaveProperty("type");
  });
});

describe("getActiveUtilitiesForProperty", () => {
  it("only queries active utilities for the given property", async () => {
    dbMock.utility.findMany.mockResolvedValue([]);

    await getActiveUtilitiesForProperty("prop-1");

    const call = dbMock.utility.findMany.mock.calls[0]?.[0];
    expect(call?.where).toEqual({ propertyId: "prop-1", active: true });
  });

  it("does not mix up recipients between different utilities", async () => {
    dbMock.utility.findMany.mockResolvedValue([
      {
        id: "utility-1",
        recipients: [{ id: "u1-recipient", email: "u1@x.com" }],
      },
      { id: "utility-2", recipients: [] },
      {
        id: "utility-3",
        recipients: [{ id: "u3-recipient", email: "u3@x.com" }],
      },
    ] as never);

    const result = await getActiveUtilitiesForProperty("prop-1");

    expect(result[0]?.recipients).toEqual([
      { id: "u1-recipient", email: "u1@x.com" },
    ]);
    expect(result[1]?.recipients).toEqual([]);
    expect(result[2]?.recipients).toEqual([
      { id: "u3-recipient", email: "u3@x.com" },
    ]);
  });

  it("returns an empty array when the property has no active utilities", async () => {
    dbMock.utility.findMany.mockResolvedValue([]);

    const result = await getActiveUtilitiesForProperty("prop-1");

    expect(result).toEqual([]);
  });

  it("only queries recipients that aren't soft-deleted", async () => {
    // A plain `{ deletedAt: null }` filter only matches documents where the
    // key is explicitly null — records that never had the key set (created
    // before this field existed, or without setting it) are missing it
    // entirely and would be silently excluded. The OR variant catches both.
    dbMock.utility.findMany.mockResolvedValue([]);

    await getActiveUtilitiesForProperty("prop-1");

    const call = dbMock.utility.findMany.mock.calls[0]?.[0];
    expect(call?.include?.recipients).toMatchObject({
      where: { OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] },
    });
  });
});

describe("getUtilityBillsForProperty", () => {
  it("queries every bill for the property, not scoped to active utilities", async () => {
    dbMock.utilityBill.findMany.mockResolvedValue([]);

    await getUtilityBillsForProperty("prop-1");

    const call = dbMock.utilityBill.findMany.mock.calls[0]?.[0];
    expect(call?.where).toEqual({ propertyId: "prop-1" });
  });

  it("orders bills by due date, newest first", async () => {
    dbMock.utilityBill.findMany.mockResolvedValue([]);

    await getUtilityBillsForProperty("prop-1");

    const call = dbMock.utilityBill.findMany.mock.calls[0]?.[0];
    expect(call?.orderBy).toEqual({ dueDate: "desc" });
  });

  it("includes the parent utility's type/provider/active for display", async () => {
    dbMock.utilityBill.findMany.mockResolvedValue([]);

    await getUtilityBillsForProperty("prop-1");

    const call = dbMock.utilityBill.findMany.mock.calls[0]?.[0];
    expect(call?.include?.utility).toEqual({
      select: { type: true, provider: true, active: true },
    });
  });

  it("returns an empty array when nothing has been generated yet", async () => {
    dbMock.utilityBill.findMany.mockResolvedValue([]);

    const result = await getUtilityBillsForProperty("prop-1");

    expect(result).toEqual([]);
  });

  it("still returns bills belonging to a now-inactive utility", async () => {
    dbMock.utilityBill.findMany.mockResolvedValue([
      {
        id: "bill-1",
        utility: { type: "ELECTRICITY", provider: "BESCOM", active: false },
      },
    ] as never);

    const result = await getUtilityBillsForProperty("prop-1");

    expect(result[0]?.utility.active).toBe(false);
  });
});
