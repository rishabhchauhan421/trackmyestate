import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { getDashboardData } from "~/server/queries/dashboard";

jest.mock("~/server/db");

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;

const HOUSEHOLD_ID = "household-1";

/** `groupBy`'s overloads are too deep for jest-mock-extended's types. */
type Model = "property" | "investment" | "loan" | "policy" | "bill";
const groupBy = (model: Model) => dbMock[model].groupBy as unknown as jest.Mock;

/** `groupBy({ by: ["currency"] })` rows: one per currency. */
function groups(
  field: string,
  sums: [currency: string | null, amount: number | null][],
) {
  return sums.map(([currency, amount]) => ({
    currency,
    _sum: { [field]: amount },
  })) as never;
}

/** Every figure in rupees, unless a test overrides one. */
function mockSums({
  property = 0,
  investment = 0,
  loan = 0,
  cover = 0,
  outflows = 0,
  inflows = 0,
}: Partial<Record<string, number>> = {}) {
  groupBy("property").mockResolvedValue(
    groups("currentEstimatedValue", [["INR", property]]),
  );
  groupBy("investment").mockResolvedValue(
    groups("currentEstimatedValue", [["INR", investment]]),
  );
  groupBy("loan").mockResolvedValue(
    groups("outstandingBalance", [["INR", loan]]),
  );
  groupBy("policy").mockResolvedValue(groups("sumAssured", [["INR", cover]]));
  groupBy("bill")
    .mockResolvedValueOnce(groups("amount", [["INR", outflows]]))
    .mockResolvedValueOnce(groups("amount", [["INR", inflows]]));
  dbMock.bill.findMany.mockResolvedValue([]);
}

beforeEach(() => {
  mockReset(dbMock);
});

describe("getDashboardData", () => {
  it("computes net worth as property + investment value minus loan outstanding", async () => {
    mockSums({
      property: 10_000_000,
      investment: 2_000_000,
      loan: 3_000_000,
      cover: 1_500_000,
      outflows: 50_000,
      inflows: 20_000,
    });

    const result = await getDashboardData(HOUSEHOLD_ID);

    expect(result.netWorth).toEqual({
      INR: 10_000_000 + 2_000_000 - 3_000_000,
    });
    expect(result.assets).toEqual({ INR: 12_000_000 });
    expect(result.totalCoverage).toEqual({ INR: 1_500_000 });
    expect(result.upcomingOutflows).toEqual({ INR: 50_000 });
    expect(result.expectedInflows).toEqual({ INR: 20_000 });
    expect(result.attentionItems).toEqual([]);
  });

  it("keeps currencies apart, counting records without one in the user's", async () => {
    mockSums();
    groupBy("property").mockResolvedValue(
      groups("currentEstimatedValue", [
        ["INR", 5_000_000],
        [null, 1_000_000],
        ["USD", 300_000],
      ]),
    );
    groupBy("loan").mockResolvedValue(
      groups("outstandingBalance", [["USD", 100_000]]),
    );

    const result = await getDashboardData(
      HOUSEHOLD_ID,
      undefined,
      undefined,
      "INR",
    );

    expect(result.propertyValue).toEqual({ INR: 6_000_000, USD: 300_000 });
    expect(result.netWorth).toEqual({ INR: 6_000_000, USD: 200_000 });
    expect(groupBy("property")).toHaveBeenCalledWith(
      expect.objectContaining({ by: ["currency"] }),
    );
  });

  it("treats missing sums (no rows) as nothing", async () => {
    mockSums();
    groupBy("property").mockResolvedValue([] as never);
    groupBy("policy").mockResolvedValue(groups("sumAssured", [["INR", null]]));

    const result = await getDashboardData(HOUSEHOLD_ID);

    expect(result.propertyValue).toEqual({});
    expect(result.totalCoverage).toEqual({});
  });

  it("allows net worth to go negative when liabilities exceed assets", async () => {
    mockSums({ property: 500_000, loan: 2_000_000 });

    const result = await getDashboardData(HOUSEHOLD_ID);

    expect(result.netWorth).toEqual({ INR: 500_000 - 2_000_000 });
  });

  it("queries attention items as overdue OR due-within-7-days, soonest first, capped at 5", async () => {
    mockSums();

    await getDashboardData(HOUSEHOLD_ID);

    const call = dbMock.bill.findMany.mock.calls[0]?.[0];
    expect(call?.where?.householdId).toBe(HOUSEHOLD_ID);
    expect(call?.where?.OR).toEqual([
      { status: "OVERDUE" },
      { status: "DUE", dueDate: { lte: expect.any(Date) as Date } },
    ]);
    expect(call?.orderBy).toEqual({ dueDate: "asc" });
    expect(call?.take).toBe(5);
  });

  it("returns whatever attentionItems the DB gives back, unmodified", async () => {
    mockSums();
    const items = [
      { id: "e1", status: "OVERDUE" },
      { id: "e2", status: "DUE" },
    ];
    dbMock.bill.findMany.mockResolvedValue(items as never);

    const result = await getDashboardData(HOUSEHOLD_ID);

    expect(result.attentionItems).toBe(items);
  });

  it("scopes the upcoming-outflows sum to open OUTFLOW statuses", async () => {
    mockSums();

    await getDashboardData(HOUSEHOLD_ID);

    const [outflowCallArgs] = groupBy("bill").mock.calls[0] as [
      { where: unknown },
    ];
    expect(outflowCallArgs?.where).toMatchObject({
      householdId: HOUSEHOLD_ID,
      direction: "OUTFLOW",
      status: { in: ["DUE", "OVERDUE", "PARTIALLY_PAID"] },
    });
  });
});
