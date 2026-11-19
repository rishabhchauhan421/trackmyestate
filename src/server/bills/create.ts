/**
 * Creating `Bill` rows. Server-only on purpose: `createBill` trusts its
 * `ownerId`/`householdId` arguments, so it must never be reachable as a
 * Server Action. Owners never create bills directly; the generator
 * (`./generate`) does, from each `BillSchedule`.
 */
import "server-only";

import type {
  Currency,
  EventCategory,
  FinancialEventType,
} from "../../../generated/prisma";
import { dateOnly, type CalendarDay } from "~/lib/calendar-day";
import { db } from "~/server/db";

/** The generation key of the bill `scheduleId` is due on `day`. */
export function scheduleBillKey(scheduleId: string, day: CalendarDay) {
  return `${scheduleId}:${day}`;
}

/** Whether `error` is a unique-index clash (Prisma code P2002). */
export function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * Creates one `Bill`. `category`/`direction` say what kind of bill this is
 * and which way the money moves; exactly one of `propertyId`/`leaseId`/
 * `loanId`/`policyId`/`investmentId` should be set, matching `category`
 * (see the `Bill` model comment in `schema.prisma`), and `billScheduleId`
 * is set only when a recurring `BillSchedule` generated this instance.
 * `description` is caller-built, since how you'd label a bill (utility type
 * + provider, "Home loan EMI - SBI", an annual premium, ...) is
 * domain-specific.
 */
export async function createBill(args: {
  ownerId: string;
  /** The household the bill belongs to (see `~/server/households`). */
  householdId?: string;
  category: EventCategory;
  direction: FinancialEventType;
  billScheduleId?: string;
  propertyId?: string;
  leaseId?: string;
  loanId?: string;
  policyId?: string;
  investmentId?: string;
  amount: number;
  /** The schedule's currency; none = the owner's. */
  currency?: Currency | null;
  /**
   * The due date as a calendar day, "YYYY-MM-DD" — not a `Date`, so a
   * caller can't hand over an instant that lands on a different day in
   * some time zone. Stored as midnight UTC (see `~/lib/calendar-day`).
   */
  dueDay: CalendarDay;
  description: string;
  /** For instalment schedules (EMIs): 1 for the first, and so on. */
  installmentNumber?: number;
  /** For EMIs: how much of `amount` repays principal, and how much is interest. */
  principalComponent?: number;
  interestComponent?: number;
  /**
   * Unique per bill (see `Bill.generationKey`): a schedule's bills use
   * `scheduleBillKey`, so a second run creating the same bill fails on the
   * index instead of duplicating it. Omitted = a random key.
   */
  generationKey?: string;
}) {
  const {
    ownerId,
    householdId,
    category,
    direction,
    billScheduleId,
    propertyId,
    leaseId,
    loanId,
    policyId,
    investmentId,
    amount,
    dueDay,
    description,
    installmentNumber,
    principalComponent,
    interestComponent,
    generationKey,
    currency,
  } = args;

  return db.bill.create({
    data: {
      ownerId,
      householdId,
      category,
      direction,
      billScheduleId,
      propertyId,
      leaseId,
      loanId,
      policyId,
      investmentId,
      dueDate: dateOnly(dueDay),
      amount,
      currency: currency ?? undefined,
      status: "DUE",
      description,
      installmentNumber,
      principalComponent,
      interestComponent,
      generationKey,
    },
  });
}
