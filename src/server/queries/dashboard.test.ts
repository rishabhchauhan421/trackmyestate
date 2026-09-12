import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { getDashboardData } from "~/server/queries/dashboard";

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
    dbMock.bill.aggregate
      .mockResolvedValueOnce(aggregateResult({ amount: 50_000 })) // outflows
      .mockResolvedValueOnce(aggregateResult({ amount: 20_000 })); // inflows
    dbMock.bill.findMany.mockResolvedValue([]);

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
    dbMock.bill.aggregate.mockResolvedValue(
      aggregateResult({ amount: null }),
    );
    dbMock.bill.findMany.mockResolvedValue([]);

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
    dbMock.bill.aggregate.mockResolvedValue(
      aggregateResult({ amount: 0 }),
    );
    dbMock.bill.findMany.mockResolvedValue([]);

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
    dbMock.bill.aggregate.mockResolvedValue(
      aggregateResult({ amount: 0 }),
    );
    dbMock.bill.findMany.mockResolvedValue([]);

    await getDashboardData(OWNER_ID);

    const call = dbMock.bill.findMany.mock.calls[0]?.[0];
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
    dbMock.bill.aggregate.mockResolvedValue(
      aggregateResult({ amount: 0 }),
    );
    const items = [
      { id: "e1", status: "OVERDUE" },
      { id: "e2", status: "DUE" },
    ];
    dbMock.bill.findMany.mockResolvedValue(items as never);

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
    dbMock.bill.aggregate.mockResolvedValue(
      aggregateResult({ amount: 0 }),
    );
    dbMock.bill.findMany.mockResolvedValue([]);

    await getDashboardData(OWNER_ID);

    const outflowCallArgs = dbMock.bill.aggregate.mock.calls[0]?.[0];
    expect(outflowCallArgs?.where).toMatchObject({
      ownerId: OWNER_ID,
      direction: "OUTFLOW",
      status: { in: ["DUE", "OVERDUE", "PARTIALLY_PAID"] },
    });
  });
});
