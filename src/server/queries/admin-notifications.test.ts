/**
 * Admin › Notifications, end to end against the in-memory database: the
 * log's channel/status/search filters, tab counts and paging, the detail
 * query, and the retry/cancel actions with their admin check.
 */
import type { Prisma } from "../../../generated/prisma";
import { db, resetMemoryDb, rows } from "~/server/__testing__/memory-db";
import {
  cancelNotification,
  retryNotification,
} from "~/server/actions/admin-notifications";
import { getSession, isAdmin } from "~/server/better-auth/server";
import {
  getNotificationDetail,
  getNotificationLog,
  getNotificationLogStats,
  LOG_PAGE_SIZE,
} from "./admin-notifications";

jest.mock("server-only", () => ({}));
jest.mock("~/server/db", () =>
  jest.requireActual<Record<string, unknown>>("~/server/__testing__/memory-db"),
);
jest.mock("~/server/better-auth/server", () => ({
  getSession: jest.fn(),
  isAdmin: jest.fn(),
}));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

const NOW = new Date("2026-10-06T06:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

let ownerId: string;

type JobInput = Partial<Prisma.NotificationJobUncheckedCreateInput>;

function job(input: JobInput = {}) {
  return db.notificationJob.create({
    data: {
      ownerId,
      category: "UTILITY_BILL",
      channel: "EMAIL",
      status: "SENT",
      recipient: "ananya@example.com",
      title: "Electricity bill due in 3 days",
      body: "Your BESCOM bill of ₹2,400 is due on 9 Oct.",
      scheduledFor: hoursAgo(2),
      idempotencyKey: `key-${Math.random()}`,
      ...input,
    },
  });
}

beforeEach(async () => {
  resetMemoryDb();
  jest.clearAllMocks();
  (getSession as jest.Mock).mockResolvedValue({
    user: { id: "admin-1", role: "admin" },
  });
  (isAdmin as unknown as jest.Mock).mockReturnValue(true);
  const owner = await db.user.create({
    data: { name: "Ananya", email: "Ananya@example.com" },
  });
  ownerId = owner.id;
});

describe("getNotificationLog", () => {
  beforeEach(async () => {
    await job({ sentAt: hoursAgo(2) });
    await job({ channel: "SMS", recipient: "+919800000001" });
    await job({
      channel: "WHATSAPP",
      status: "FAILED",
      recipient: "+919800000002",
      failedReason: "Provider rejected the number",
    });
    await job({
      status: "SCHEDULED",
      recipient: "brother@example.com",
      title: "Home loan EMI due today",
      metadata: { guestId: "guest-1" },
    });
  });

  it("lists everything newest first with counts per channel", async () => {
    await job({ title: "Newest", scheduledFor: hoursAgo(0.5) });

    const log = await getNotificationLog();

    expect(log.total).toBe(5);
    expect(log.rows[0]!.title).toBe("Newest");
    expect(log.counts).toEqual({ ALL: 5, EMAIL: 3, SMS: 1, WHATSAPP: 1 });
    expect(log.rows[0]!.ownerName).toBe("Ananya");
  });

  it("filters by channel without changing the tab counts", async () => {
    const log = await getNotificationLog({ channel: "SMS" });

    expect(log.rows.map((r) => r.recipient)).toEqual(["+919800000001"]);
    expect(log.total).toBe(1);
    expect(log.counts.ALL).toBe(4);
  });

  it("filters by status, and tab counts follow the status", async () => {
    const log = await getNotificationLog({ status: "FAILED" });

    expect(log.rows).toHaveLength(1);
    expect(log.rows[0]!.channel).toBe("WHATSAPP");
    expect(log.counts).toEqual({ ALL: 1, EMAIL: 0, SMS: 0, WHATSAPP: 1 });
  });

  it("searches recipient and subject, ignoring case", async () => {
    expect(
      (await getNotificationLog({ q: "BROTHER" })).rows.map((r) => r.title),
    ).toEqual(["Home loan EMI due today"]);
    expect((await getNotificationLog({ q: "emi due" })).total).toBe(1);
    expect((await getNotificationLog({ q: "   " })).total).toBe(4);
  });

  it("labels who each notification went to", async () => {
    const roles = Object.fromEntries(
      (await getNotificationLog()).rows.map((r) => [
        r.recipient,
        r.recipientRole,
      ]),
    );
    // The owner's email is stored with different casing.
    expect(roles["ananya@example.com"]).toBe("owner");
    expect(roles["brother@example.com"]).toBe("guest");
    expect(roles["+919800000001"]).toBe("recipient");
  });

  it("pages through the results", async () => {
    for (let i = 0; i < LOG_PAGE_SIZE; i++) {
      await job({ scheduledFor: hoursAgo(10 + i) });
    }

    const second = await getNotificationLog({ page: 2 });

    expect(second.pageCount).toBe(2);
    expect(second.rows).toHaveLength(4);
    expect((await getNotificationLog({ page: 0 })).page).toBe(1);
  });
});

describe("getNotificationLogStats", () => {
  it("counts recent sends, the queue, cancellations and failures", async () => {
    await job({ sentAt: hoursAgo(2) });
    await job({ sentAt: hoursAgo(30) }); // outside 24 h
    await job({ status: "SCHEDULED", scheduledFor: hoursAgo(-3) });
    await job({ status: "SCHEDULED", scheduledFor: hoursAgo(1) }); // due, not "queued"
    await job({ status: "CANCELLED" });
    await job({ status: "FAILED" });

    expect(await getNotificationLogStats(NOW)).toEqual({
      sent24h: 1,
      queued: 1,
      cancelled7d: 1,
      failed7d: 1,
    });
  });
});

describe("getNotificationDetail", () => {
  it("returns the job with its owner, bill and guest", async () => {
    const bill = await db.bill.create({
      data: {
        ownerId,
        amount: 2400,
        dueDate: new Date(Date.UTC(2026, 9, 9)),
        status: "DUE",
        category: "UTILITY_BILL",
        direction: "OUTFLOW",
        description: "BESCOM electricity",
      },
    });
    const guest = await db.guest.create({
      data: { ownerId, name: "Rahul", email: "brother@example.com" },
    });
    const created = await job({
      billId: bill.id,
      recipient: "brother@example.com",
      metadata: { guestId: guest.id },
    });

    const detail = await getNotificationDetail(created.id);

    expect(detail?.owner?.name).toBe("Ananya");
    expect(detail?.bill?.description).toBe("BESCOM electricity");
    expect(detail?.guest?.name).toBe("Rahul");
    expect(detail?.recipientRole).toBe("guest");
  });

  it("returns null for an unknown id", async () => {
    expect(await getNotificationDetail("000000000000000000000000")).toBeNull();
  });
});

describe("retryNotification / cancelNotification", () => {
  it("re-queues a failed notification with fresh attempts", async () => {
    const failed = await job({
      status: "FAILED",
      retryCount: 3,
      failedReason: "Timeout",
    });

    await expect(retryNotification(failed.id)).rejects.toThrow(
      `REDIRECT:/admin/notifications/${failed.id}?done=retried`,
    );

    expect(rows("notificationJob")[0]).toMatchObject({
      status: "SCHEDULED",
      retryCount: 0,
      failedReason: null,
    });
  });

  it("won't retry a notification that didn't fail", async () => {
    const cancelled = await job({ status: "CANCELLED" });

    await expect(retryNotification(cancelled.id)).rejects.toThrow(
      "Only a failed notification can be retried",
    );
    expect(rows("notificationJob")[0]!.status).toBe("CANCELLED");
  });

  it("cancels a queued notification, but not a sent one", async () => {
    const queued = await job({ status: "SCHEDULED" });
    const sent = await job();

    await expect(cancelNotification(queued.id)).rejects.toThrow("REDIRECT:");
    await expect(cancelNotification(sent.id)).rejects.toThrow("still queued");

    expect(rows("notificationJob").map((r) => r.status)).toEqual([
      "CANCELLED",
      "SENT",
    ]);
  });

  it("refuses non-admins and sends signed-out users to log in", async () => {
    const failed = await job({ status: "FAILED" });
    (isAdmin as unknown as jest.Mock).mockReturnValue(false);

    await expect(retryNotification(failed.id)).rejects.toThrow("Only admins");
    await expect(cancelNotification(failed.id)).rejects.toThrow("Only admins");

    (getSession as jest.Mock).mockResolvedValue(null);
    await expect(retryNotification(failed.id)).rejects.toThrow(
      "REDIRECT:/login",
    );
    expect(rows("notificationJob")[0]!.status).toBe("FAILED");
  });
});
