import { mockReset, type DeepMockProxy } from "jest-mock-extended";

import type { PrismaClient } from "../../generated/prisma";
import { db } from "~/server/db";
import { allowAuthAttempt, clientIp, consumeAttempt } from "./rate-limit";

jest.mock("~/server/db");
const headersMock = jest.fn(async () => new Headers());
jest.mock("next/headers", () => ({ headers: () => headersMock() }));

const dbMock = db as unknown as DeepMockProxy<PrismaClient>;
const RULE = { limit: 3, windowMs: 60_000 };
const NOW = new Date("2026-11-19T10:00:00Z");

beforeEach(() => {
  mockReset(dbMock);
  headersMock.mockReset().mockResolvedValue(new Headers());
});

describe("consumeAttempt", () => {
  it("opens a new window on the first attempt", async () => {
    dbMock.authThrottle.updateMany.mockResolvedValue({ count: 0 });

    await expect(consumeAttempt("k", RULE, NOW)).resolves.toBe(true);
    expect(dbMock.authThrottle.updateMany).toHaveBeenCalledWith({
      where: {
        key: "k",
        windowStart: { gt: new Date(NOW.getTime() - RULE.windowMs) },
      },
      data: { count: { increment: 1 } },
    });
    expect(dbMock.authThrottle.upsert).toHaveBeenCalledWith({
      where: { key: "k" },
      create: { key: "k", count: 1, windowStart: NOW },
      update: { count: 1, windowStart: NOW },
    });
  });

  it("allows attempts up to the limit within a window", async () => {
    dbMock.authThrottle.updateMany.mockResolvedValue({ count: 1 });
    dbMock.authThrottle.findUnique.mockResolvedValue({ count: 3 } as never);

    await expect(consumeAttempt("k", RULE, NOW)).resolves.toBe(true);
    expect(dbMock.authThrottle.upsert).not.toHaveBeenCalled();
  });

  it("refuses attempts over the limit", async () => {
    dbMock.authThrottle.updateMany.mockResolvedValue({ count: 1 });
    dbMock.authThrottle.findUnique.mockResolvedValue({ count: 4 } as never);

    await expect(consumeAttempt("k", RULE, NOW)).resolves.toBe(false);
  });

  it("counts against the row a concurrent request created", async () => {
    dbMock.authThrottle.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    dbMock.authThrottle.upsert.mockRejectedValueOnce({ code: "P2002" });
    dbMock.authThrottle.findUnique.mockResolvedValue({ count: 2 } as never);

    await expect(consumeAttempt("k", RULE, NOW)).resolves.toBe(true);
    expect(dbMock.authThrottle.updateMany).toHaveBeenCalledTimes(2);
  });

  it("rethrows other database errors", async () => {
    dbMock.authThrottle.updateMany.mockResolvedValue({ count: 0 });
    dbMock.authThrottle.upsert.mockRejectedValue(new Error("db down"));

    await expect(consumeAttempt("k", RULE, NOW)).rejects.toThrow("db down");
  });
});

describe("clientIp", () => {
  it("takes the first x-forwarded-for address", async () => {
    headersMock.mockResolvedValue(
      new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
    );
    await expect(clientIp()).resolves.toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then 'unknown'", async () => {
    headersMock.mockResolvedValue(new Headers({ "x-real-ip": "198.51.100.2" }));
    await expect(clientIp()).resolves.toBe("198.51.100.2");
    headersMock.mockResolvedValue(new Headers());
    await expect(clientIp()).resolves.toBe("unknown");
  });
});

describe("allowAuthAttempt", () => {
  beforeEach(() => {
    headersMock.mockResolvedValue(
      new Headers({ "x-forwarded-for": "203.0.113.7" }),
    );
    dbMock.authThrottle.updateMany.mockResolvedValue({ count: 0 });
  });

  it("counts by IP and by lower-cased email", async () => {
    await expect(allowAuthAttempt("signIn", "Owner@Example.com")).resolves.toBe(
      true,
    );
    const keys = dbMock.authThrottle.updateMany.mock.calls.map(
      ([arg]) => (arg.where as { key: string }).key,
    );
    expect(keys).toEqual([
      "signIn:ip:203.0.113.7",
      "signIn:email:owner@example.com",
    ]);
  });

  it("refuses when either counter is over its limit", async () => {
    dbMock.authThrottle.updateMany.mockResolvedValue({ count: 1 });
    dbMock.authThrottle.findUnique
      .mockResolvedValueOnce({ count: 1 } as never)
      .mockResolvedValueOnce({ count: 99 } as never);

    await expect(allowAuthAttempt("signUp", "a@example.com")).resolves.toBe(
      false,
    );
  });

  it("counts only the IP when there's no email", async () => {
    await allowAuthAttempt("signIn");
    expect(dbMock.authThrottle.updateMany).toHaveBeenCalledTimes(1);
  });
});
