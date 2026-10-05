import { db, resetMemoryDb, rows } from "./memory-db";

beforeEach(() => resetMemoryDb());

describe("memory-db (test double for the Prisma client)", () => {
  it("treats a never-set field as missing, not null — like MongoDB", async () => {
    await db.guest.create({ data: { ownerId: "u", name: "A" } as never });
    await db.guest.create({
      data: { ownerId: "u", name: "B", pausedAt: null } as never,
    });

    const nullOnly = await db.guest.findMany({ where: { pausedAt: null } });
    const missingOnly = await db.guest.findMany({
      where: { pausedAt: { isSet: false } },
    });
    expect(nullOnly.map((g) => g.name)).toEqual(["B"]);
    expect(missingOnly.map((g) => g.name)).toEqual(["A"]);
  });

  it("enforces the idempotencyKey unique index, counting a missing key as a value", async () => {
    const job = { ownerId: "u", title: "t" } as never;
    await db.notificationJob.create({ data: job });
    await expect(
      db.notificationJob.create({ data: job }),
    ).rejects.toMatchObject({ code: "P2002" });

    await db.notificationJob.create({
      data: { ownerId: "u", idempotencyKey: "k" } as never,
    });
    await expect(
      db.notificationJob.create({
        data: { ownerId: "u", idempotencyKey: "k" } as never,
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("supports in/range/AND/OR filters, ordering, cursor paging", async () => {
    for (const n of [3, 1, 2]) {
      await db.bill.create({
        data: {
          ownerId: "u",
          amount: n,
          status: n === 2 ? "PAID" : "DUE",
        } as never,
      });
    }

    const open = await db.bill.findMany({
      where: { status: { in: ["DUE", "OVERDUE"] }, amount: { gte: 1, lt: 3 } },
    });
    expect(open.map((b) => b.amount)).toEqual([1]);

    const sorted = await db.bill.findMany({ orderBy: { amount: "asc" } });
    const page = await db.bill.findMany({
      orderBy: { amount: "asc" },
      cursor: { id: sorted[0]!.id },
      skip: 1,
      take: 1,
    });
    expect(page.map((b) => b.amount)).toEqual([2]);

    const either = await db.bill.findMany({
      where: { OR: [{ amount: 1 }, { amount: 3 }] },
    });
    expect(either).toHaveLength(2);
  });

  it("stamps updatedAt and supports increment", async () => {
    const created = await db.notificationJob.create({
      data: { ownerId: "u", idempotencyKey: "k", retryCount: 0 } as never,
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await db.notificationJob.updateMany({
      where: { id: created.id },
      data: { retryCount: { increment: 1 } } as never,
    });

    const [row] = rows("notificationJob");
    expect(row!.retryCount).toBe(1);
    expect((row!.updatedAt as Date).getTime()).toBeGreaterThan(
      created.updatedAt.getTime(),
    );
  });

  it("returns copies, so callers can't mutate the store by accident", async () => {
    const created = await db.user.create({
      data: { name: "A", email: "a@x" } as never,
    });
    created.name = "changed";
    expect(rows("user")[0]!.name).toBe("A");
  });
});
