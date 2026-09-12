import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../../generated/prisma";
import { db } from "~/server/db";
import { getAdminOverview, listUsers } from "~/server/queries/admin";

jest.mock("~/server/db");

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;

function aggregateResult(sum: Record<string, number | null>) {
  return { _sum: sum } as never;
}

beforeEach(() => {
  mockReset(dbMock);
});

describe("getAdminOverview", () => {
  function mockCommonCounts() {
    dbMock.user.count.mockResolvedValue(0);
    dbMock.property.aggregate.mockResolvedValue(
      aggregateResult({ currentEstimatedValue: 0 }),
    );
    dbMock.investment.aggregate.mockResolvedValue(
      aggregateResult({ currentEstimatedValue: 0 }),
    );
    dbMock.loan.aggregate.mockResolvedValue(
      aggregateResult({ outstandingBalance: 0 }),
    );
    dbMock.property.count.mockResolvedValue(0);
    dbMock.investment.count.mockResolvedValue(0);
    dbMock.loan.count.mockResolvedValue(0);
    dbMock.policy.count.mockResolvedValue(0);
    dbMock.document.count.mockResolvedValue(0);
    dbMock.notificationRule.count.mockResolvedValue(0);
    dbMock.notificationJob.count.mockResolvedValue(0);
  }

  it("computes platform-wide tracked value as property + investment value minus loan outstanding, unscoped by owner", async () => {
    mockCommonCounts();
    dbMock.property.aggregate.mockResolvedValue(
      aggregateResult({ currentEstimatedValue: 50_000_000 }),
    );
    dbMock.investment.aggregate.mockResolvedValue(
      aggregateResult({ currentEstimatedValue: 10_000_000 }),
    );
    dbMock.loan.aggregate.mockResolvedValue(
      aggregateResult({ outstandingBalance: 15_000_000 }),
    );

    const result = await getAdminOverview();

    expect(result.trackedValue).toBe(50_000_000 + 10_000_000 - 15_000_000);
    expect(dbMock.property.aggregate).toHaveBeenCalledWith({
      _sum: { currentEstimatedValue: true },
    });
  });

  it("counts users total plus 7d/30d/banned breakdowns", async () => {
    mockCommonCounts();
    dbMock.user.count
      .mockResolvedValueOnce(120) // total
      .mockResolvedValueOnce(4) // 7d
      .mockResolvedValueOnce(15) // 30d
      .mockResolvedValueOnce(2); // banned

    const result = await getAdminOverview();

    expect(result.users).toEqual({
      total: 120,
      new7d: 4,
      new30d: 15,
      banned: 2,
    });
  });

  it("tallies notification jobs by every NotificationStatus value", async () => {
    mockCommonCounts();
    // Order matches `NOTIFICATION_STATUSES` in `admin.ts`: SCHEDULED,
    // PROCESSING, SENT, FAILED, CANCELLED, SKIPPED.
    dbMock.notificationJob.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(42)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const result = await getAdminOverview();

    expect(result.notificationsByStatus).toEqual({
      SCHEDULED: 0,
      PROCESSING: 0,
      SENT: 42,
      FAILED: 0,
      CANCELLED: 0,
      SKIPPED: 0,
    });
  });

  it("counts only active notification rules", async () => {
    mockCommonCounts();
    dbMock.notificationRule.count.mockResolvedValue(7);

    const result = await getAdminOverview();

    expect(result.activeNotificationRules).toBe(7);
    expect(dbMock.notificationRule.count).toHaveBeenCalledWith({
      where: { active: true },
    });
  });
});

describe("listUsers", () => {
  it("maps each user with its portfolio-size counts, defaulting a null role/banned", async () => {
    dbMock.user.findMany.mockResolvedValue([
      {
        id: "user-1",
        name: "Asha Rao",
        email: "asha@example.com",
        role: null,
        banned: null,
        currency: "INR",
        createdAt: new Date("2026-01-01"),
        _count: { properties: 3, investments: 1, loans: 0 },
      },
    ] as never);

    const result = await listUsers();

    expect(result).toEqual([
      {
        id: "user-1",
        name: "Asha Rao",
        email: "asha@example.com",
        role: null,
        banned: false,
        currency: "INR",
        createdAt: new Date("2026-01-01"),
        propertyCount: 3,
        investmentCount: 1,
        loanCount: 0,
      },
    ]);
    expect(dbMock.user.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { properties: true, investments: true, loans: true } },
      },
    });
  });

  it("passes through an explicit admin role and banned flag", async () => {
    dbMock.user.findMany.mockResolvedValue([
      {
        id: "user-2",
        name: "Rishabh",
        email: "rishabh@oddscrew.com",
        role: "admin",
        banned: true,
        currency: "INR",
        createdAt: new Date("2026-01-01"),
        _count: { properties: 0, investments: 0, loans: 0 },
      },
    ] as never);

    const result = await listUsers();

    expect(result[0]?.role).toBe("admin");
    expect(result[0]?.banned).toBe(true);
  });
});
