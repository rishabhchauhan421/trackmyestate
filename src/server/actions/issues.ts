"use server";

/**
 * Server Actions for a property's issues: whatever stops it from being
 * fully clear (a dispute, a pending freehold conversion, unpaid dues, a
 * pending registration). See `PropertyIssue` in `prisma/schema.prisma`.
 *
 * An issue holds key dates and a dated log of notes itself. What's owed
 * under it is ordinary `Bill`s of category PROPERTY_DUE (`addDues`, one or
 * a whole instalment plan), so they get the reminders, "Mark paid" link,
 * part payments and timeline every other bill has. A due can also hang
 * straight off the property, with no issue.
 *
 * Closing an issue (`closeIssue`: resolved, or dropped) cancels its queued
 * alerts and, if asked, its unpaid dues. Every change bumps
 * `lastActivityAt`, which the "gone quiet" alert measures from (see
 * `~/server/issues/alerts`).
 */

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { z } from "zod";

import {
  FinancialEventType,
  PropertyIssueType,
} from "../../../generated/prisma";
import { calendarDayOf, dateOnly } from "~/lib/calendar-day";
import {
  checkbox,
  date,
  enumValue,
  FormError,
  money,
  number,
  optionalDate,
  optionalText,
  parseFormData,
  text,
} from "~/lib/form";
import {
  MAX_PLAN_INSTALMENTS,
  PLAN_INTERVAL_MONTHS,
  planInstalments,
  type Instalment,
  type PlanInterval,
} from "~/lib/issues";
import { toMinorUnits } from "~/lib/money";
import { createBill } from "~/server/bills/create";
import { db } from "~/server/db";
import { toFormState, type FormState } from "~/server/form-state";
import { requireScope } from "~/server/households";
import { OPEN_PAYMENT_STATUSES } from "~/server/queries/shared";
import { todayFor } from "~/server/schedules/lifecycle";

const issuePath = (propertyId: string, issueId: string) =>
  `/properties/${propertyId}/issues/${issueId}`;

function revalidateIssue(propertyId: string, issueId?: string) {
  revalidatePath(`/properties/${propertyId}`);
  revalidatePath("/properties");
  revalidatePath("/dashboard");
  revalidatePath("/timeline");
  if (issueId) revalidatePath(issuePath(propertyId, issueId));
}

async function requireProperty(propertyId: string, householdId: string) {
  const property = await db.property.findFirst({
    where: { id: propertyId, householdId },
  });
  if (!property) throw new FormError("Property not found");
  return property;
}

async function requireIssue(issueId: string, householdId: string) {
  const issue = await db.propertyIssue.findFirst({
    where: { id: issueId, householdId },
  });
  if (!issue) throw new FormError("Issue not found");
  return issue;
}

/** An issue that can still be changed: closed ones are reopened first. */
async function requireOpenIssue(issueId: string, householdId: string) {
  const issue = await requireIssue(issueId, householdId);
  if (issue.status !== "OPEN") {
    throw new FormError("Reopen this issue to change it");
  }
  return issue;
}

/** Cancels the alerts still queued for an issue (it closed or was removed). */
async function cancelIssueAlerts(issueId: string, reason: string) {
  await db.notificationJob.updateMany({
    where: { propertyIssueId: issueId, status: "SCHEDULED" },
    data: { status: "CANCELLED", failedReason: reason },
  });
}

/**
 * Removes unpaid dues matching `where` (a soft delete, like a schedule's
 * unpaid bills) and cancels their queued reminders. A part-paid due is
 * kept: money has moved against it.
 */
async function removeUnpaidDues(where: {
  propertyIssueId?: string;
  id?: string;
  householdId: string;
}) {
  const bills = await db.bill.findMany({
    where: {
      ...where,
      category: "PROPERTY_DUE",
      status: { in: ["DUE", "OVERDUE"] },
    },
    select: { id: true },
  });
  if (bills.length === 0) return 0;
  const ids = bills.map((bill) => bill.id);
  await db.bill.updateMany({
    where: { id: { in: ids } },
    data: { deletedAt: new Date() },
  });
  await db.notificationJob.updateMany({
    where: { billId: { in: ids }, status: "SCHEDULED" },
    data: { status: "CANCELLED", failedReason: "Bill was removed" },
  });
  return ids.length;
}

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

const issueDetailsSchema = z.object({
  type: enumValue(PropertyIssueType, "Choose what kind of issue this is"),
  title: text("Give the issue a short title"),
  description: optionalText(),
  counterparty: optionalText(),
  reference: optionalText(),
  openedOn: optionalDate("Enter a valid start date"),
});

const createIssueSchema = issueDetailsSchema.extend({
  propertyId: text("Property not found"),
  // An optional first key date, so a hearing can be set while adding.
  keyDateLabel: optionalText(),
  keyDate: optionalDate("Enter a valid key date"),
});

/** Adds an open issue to a property, from the "Add issue" form. */
export async function createIssue(formData: FormData) {
  const scope = await requireScope();
  const { propertyId, keyDateLabel, keyDate, openedOn, ...details } =
    parseFormData(createIssueSchema, formData);
  await requireProperty(propertyId, scope.householdId);
  if (keyDateLabel && !keyDate) {
    throw new FormError("Enter the date for the key date", "keyDate");
  }

  const issue = await db.propertyIssue.create({
    data: {
      ...details,
      ownerId: scope.userId,
      householdId: scope.householdId,
      propertyId,
      openedOn: openedOn ?? (await todayFor(scope.userId)),
      keyDates: keyDate
        ? [
            {
              id: randomUUID(),
              label: keyDateLabel ?? "Next date",
              date: keyDate,
              done: false,
            },
          ]
        : [],
    },
  });

  revalidateIssue(propertyId);
  redirect(issuePath(propertyId, issue.id));
}

/** Changes an issue's details, from the "Edit issue" form. */
export async function updateIssue(issueId: string, formData: FormData) {
  const scope = await requireScope();
  const issue = await requireIssue(issueId, scope.householdId);
  const { openedOn, ...details } = parseFormData(issueDetailsSchema, formData);

  await db.propertyIssue.update({
    where: { id: issue.id },
    data: {
      ...details,
      openedOn: openedOn ?? issue.openedOn,
      lastActivityAt: new Date(),
    },
  });

  revalidateIssue(issue.propertyId, issue.id);
  redirect(issuePath(issue.propertyId, issue.id));
}

const keyDateSchema = z.object({
  label: text("Say what the date is for"),
  date: date("Enter a valid date", "Enter the date"),
});

/**
 * Adds a key date (next hearing, a deadline, an expected decision). Dates
 * already passed are ticked done, since a new date supersedes them: this
 * is the "set the next date" answer to a "Finalise this?" alert.
 */
export async function addKeyDate(issueId: string, formData: FormData) {
  const scope = await requireScope();
  const issue = await requireOpenIssue(issueId, scope.householdId);
  const { label, date: keyDate } = parseFormData(keyDateSchema, formData);
  const today = await todayFor(scope.userId);

  await db.propertyIssue.update({
    where: { id: issue.id },
    data: {
      keyDates: [
        ...issue.keyDates.map((existing) =>
          existing.date < today ? { ...existing, done: true } : existing,
        ),
        { id: randomUUID(), label, date: keyDate, done: false },
      ],
      lastActivityAt: new Date(),
    },
  });

  revalidateIssue(issue.propertyId, issue.id);
  // Back to the page with an empty form.
  redirect(issuePath(issue.propertyId, issue.id));
}

/** Ticks a key date done (it happened) or not done. */
export async function setKeyDateDone(
  issueId: string,
  keyDateId: string,
  done: boolean,
) {
  const scope = await requireScope();
  const issue = await requireOpenIssue(issueId, scope.householdId);

  await db.propertyIssue.update({
    where: { id: issue.id },
    data: {
      keyDates: issue.keyDates.map((keyDate) =>
        keyDate.id === keyDateId ? { ...keyDate, done } : keyDate,
      ),
      lastActivityAt: new Date(),
    },
  });

  revalidateIssue(issue.propertyId, issue.id);
}

/** Removes a key date added by mistake. */
export async function removeKeyDate(issueId: string, keyDateId: string) {
  const scope = await requireScope();
  const issue = await requireOpenIssue(issueId, scope.householdId);

  await db.propertyIssue.update({
    where: { id: issue.id },
    data: {
      keyDates: issue.keyDates.filter((keyDate) => keyDate.id !== keyDateId),
      lastActivityAt: new Date(),
    },
  });

  revalidateIssue(issue.propertyId, issue.id);
}

const noteSchema = z.object({ text: text("Write the note first") });

/** Adds a dated note to the issue's log (kept after it closes, too). */
export async function addIssueNote(issueId: string, formData: FormData) {
  const scope = await requireScope();
  const issue = await requireIssue(issueId, scope.householdId);
  const { text: noteText } = parseFormData(noteSchema, formData);

  await db.propertyIssue.update({
    where: { id: issue.id },
    data: {
      notes: [
        ...issue.notes,
        {
          id: randomUUID(),
          at: new Date(),
          authorName: scope.user.name,
          text: noteText,
        },
      ],
      lastActivityAt: new Date(),
    },
  });

  revalidateIssue(issue.propertyId, issue.id);
  redirect(issuePath(issue.propertyId, issue.id));
}

const closeIssueSchema = z.object({
  result: z.enum(["RESOLVED", "DROPPED"], {
    error: "Choose how the issue ended",
  }),
  outcome: optionalText(),
  resolvedOn: optionalDate("Enter a valid date"),
  // Ticked: unpaid dues under the issue no longer apply and are removed.
  cancelUnpaid: checkbox(),
  // Ticked (freehold conversions): the property is now freehold.
  markFreehold: checkbox(),
});

/**
 * Closes an issue as resolved or dropped: records the outcome, stops its
 * alerts, and removes its unpaid dues if asked (part-paid and paid ones
 * always stay, as payment history).
 */
export async function closeIssue(issueId: string, formData: FormData) {
  const scope = await requireScope();
  const issue = await requireOpenIssue(issueId, scope.householdId);
  const { result, outcome, resolvedOn, cancelUnpaid, markFreehold } =
    parseFormData(closeIssueSchema, formData);

  await db.propertyIssue.update({
    where: { id: issue.id },
    data: {
      status: result,
      outcome,
      resolvedOn: resolvedOn ?? (await todayFor(scope.userId)),
      lastActivityAt: new Date(),
    },
  });
  await cancelIssueAlerts(issue.id, `Issue was ${result.toLowerCase()}`);
  if (cancelUnpaid) {
    await removeUnpaidDues({
      propertyIssueId: issue.id,
      householdId: scope.householdId,
    });
  }
  if (
    markFreehold &&
    result === "RESOLVED" &&
    issue.type === "FREEHOLD_CONVERSION"
  ) {
    await db.property.update({
      where: { id: issue.propertyId },
      data: { ownershipType: "FREEHOLD", freeholdAlertsSince: null },
    });
  }

  revalidateIssue(issue.propertyId, issue.id);
  redirect(issuePath(issue.propertyId, issue.id));
}

/** Reopens a closed issue (it came back, or was closed by mistake). */
export async function reopenIssue(issueId: string) {
  const scope = await requireScope();
  const issue = await requireIssue(issueId, scope.householdId);
  if (issue.status === "OPEN") return;

  await db.propertyIssue.update({
    where: { id: issue.id },
    data: {
      status: "OPEN",
      resolvedOn: null,
      outcome: null,
      lastActivityAt: new Date(),
    },
  });

  revalidateIssue(issue.propertyId, issue.id);
}

/**
 * Deletes an issue added by mistake (a soft delete). Its unpaid dues go
 * with it; dues with payments against them stay on the property.
 */
export async function deleteIssue(issueId: string) {
  const scope = await requireScope();
  const issue = await requireIssue(issueId, scope.householdId);

  await db.propertyIssue.update({
    where: { id: issue.id },
    data: { deletedAt: new Date() },
  });
  await cancelIssueAlerts(issue.id, "Issue was removed");
  await removeUnpaidDues({
    propertyIssueId: issue.id,
    householdId: scope.householdId,
  });

  revalidateIssue(issue.propertyId);
  redirect(`/properties/${issue.propertyId}`);
}

// ---------------------------------------------------------------------------
// Dues (future payments)
// ---------------------------------------------------------------------------

const dueSchema = z.object({
  propertyId: text("Property not found"),
  issueId: optionalText(),
  label: text("Say what the payment is for"),
  direction: enumValue(FinancialEventType, "Choose who pays"),
  mode: z.enum(["single", "plan"], { error: "Choose one payment or a plan" }),
});

const singleDueSchema = z.object({
  amount: money(
    "Enter an amount greater than zero",
    { positive: true },
    "Enter the amount",
  ),
  dueDate: date("Enter a valid due date", "Enter the due date"),
});

const planSchema = z.object({
  total: money(
    "Enter a total greater than zero",
    { positive: true },
    "Enter the total amount",
  ),
  count: number(
    `Enter between 2 and ${MAX_PLAN_INSTALMENTS} instalments`,
    { int: true, min: 2, max: MAX_PLAN_INSTALMENTS },
    "Enter the number of instalments",
  ),
  firstDueDate: date(
    "Enter a valid first due date",
    "Enter the first due date",
  ),
  interval: z.enum(
    Object.keys(PLAN_INTERVAL_MONTHS) as [PlanInterval, ...PlanInterval[]],
    { error: "Choose how often the instalments fall" },
  ),
});

/**
 * The plan's instalments as edited in the form's preview (repeated
 * `instalmentAmount`/`instalmentDate` fields), or null when the form sent
 * none (no JavaScript), in which case the even split is used.
 */
function editedInstalments(formData: FormData): Instalment[] | null {
  const amounts = formData.getAll("instalmentAmount");
  const dates = formData.getAll("instalmentDate");
  if (amounts.length === 0) return null;
  if (amounts.length !== dates.length) {
    throw new FormError("Every instalment needs an amount and a date");
  }
  if (amounts.length > MAX_PLAN_INSTALMENTS) {
    throw new FormError(`A plan can have ${MAX_PLAN_INSTALMENTS} instalments`);
  }
  return amounts.map((rawAmount, index) => {
    const amount = Number(rawAmount);
    const rawDay = dates[index];
    const day = typeof rawDay === "string" ? rawDay : "";
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new FormError(
        `Enter an amount greater than zero for instalment ${index + 1}`,
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || isNaN(Date.parse(day))) {
      throw new FormError(`Enter a valid date for instalment ${index + 1}`);
    }
    return { number: index + 1, dueDay: day, amount: toMinorUnits(amount) };
  });
}

/**
 * Adds future payments to a property, optionally under one of its issues:
 * one payment, or an instalment plan that becomes one bill per instalment
 * ("Builder instalment (3 of 8)"). From the "Add payment" form.
 */
export async function addDues(formData: FormData) {
  const scope = await requireScope();
  const { propertyId, issueId, label, direction, mode } = parseFormData(
    dueSchema,
    formData,
  );
  const property = await requireProperty(propertyId, scope.householdId);
  const issue = issueId
    ? await requireOpenIssue(issueId, scope.householdId)
    : null;
  if (issue && issue.propertyId !== propertyId) {
    throw new FormError("Issue not found");
  }

  let instalments: Instalment[];
  if (mode === "single") {
    const { amount, dueDate } = parseFormData(singleDueSchema, formData);
    instalments = [{ number: 1, dueDay: calendarDayOf(dueDate), amount }];
  } else {
    const { total, count, firstDueDate, interval } = parseFormData(
      planSchema,
      formData,
    );
    instalments =
      editedInstalments(formData) ??
      planInstalments({
        total,
        count,
        firstDueDay: calendarDayOf(firstDueDate),
        interval,
      });
  }

  const planned = instalments.length > 1;
  for (const instalment of instalments) {
    await createBill({
      ownerId: scope.userId,
      householdId: scope.householdId,
      category: "PROPERTY_DUE",
      direction,
      propertyId,
      propertyIssueId: issue?.id,
      amount: instalment.amount,
      currency: property.currency,
      dueDay: instalment.dueDay,
      description: planned
        ? `${label} (${instalment.number} of ${instalments.length})`
        : label,
      installmentNumber: planned ? instalment.number : undefined,
    });
  }
  if (issue) {
    await db.propertyIssue.update({
      where: { id: issue.id },
      data: { lastActivityAt: new Date() },
    });
  }

  revalidateIssue(propertyId, issue?.id);
  redirect(
    issue ? issuePath(propertyId, issue.id) : `/properties/${propertyId}`,
  );
}

const updateDueSchema = z.object({
  label: text("Say what the payment is for"),
  amount: money(
    "Enter an amount greater than zero",
    { positive: true },
    "Enter the amount",
  ),
  dueDate: date("Enter a valid due date", "Enter the due date"),
});

async function requireUnpaidDue(billId: string, householdId: string) {
  const bill = await db.bill.findFirst({
    where: { id: billId, householdId, category: "PROPERTY_DUE" },
  });
  if (!bill) throw new FormError("Payment not found");
  if (!(OPEN_PAYMENT_STATUSES as readonly string[]).includes(bill.status)) {
    throw new FormError("This payment is already closed");
  }
  return bill;
}

/**
 * Changes an unpaid due's label, amount or date (an estimate firmed up, a
 * date moved). Reminders already queued for the old date are cancelled;
 * the new date gets its own.
 */
export async function updateDue(billId: string, formData: FormData) {
  const scope = await requireScope();
  const bill = await requireUnpaidDue(billId, scope.householdId);
  const { label, amount, dueDate } = parseFormData(updateDueSchema, formData);
  if (bill.status === "PARTIALLY_PAID" && amount < (bill.paidAmount ?? 0)) {
    throw new FormError(
      "The amount can't be less than what's already been paid",
      "amount",
    );
  }

  await db.bill.update({
    where: { id: bill.id },
    data: {
      description: label,
      amount,
      dueDate: dateOnly(calendarDayOf(dueDate)),
      // A new date is a fresh start: it's due again, not overdue.
      status: bill.status === "OVERDUE" ? "DUE" : bill.status,
    },
  });
  if (dueDate.getTime() !== bill.dueDate.getTime()) {
    await db.notificationJob.updateMany({
      where: { billId: bill.id, status: "SCHEDULED" },
      data: { status: "CANCELLED", failedReason: "Due date changed" },
    });
  }

  revalidateIssue(bill.propertyId ?? "", bill.propertyIssueId ?? undefined);
  revalidatePath(`/bills/${bill.id}`);
  redirect(`/bills/${bill.id}`);
}

/** Removes an unpaid due that no longer applies. */
export async function removeDue(billId: string) {
  const scope = await requireScope();
  const bill = await requireUnpaidDue(billId, scope.householdId);
  if (bill.status === "PARTIALLY_PAID") {
    throw new FormError("A part-paid payment can't be removed");
  }

  await removeUnpaidDues({ id: bill.id, householdId: scope.householdId });

  revalidateIssue(bill.propertyId ?? "", bill.propertyIssueId ?? undefined);
  redirect(
    bill.propertyIssueId && bill.propertyId
      ? issuePath(bill.propertyId, bill.propertyIssueId)
      : `/properties/${bill.propertyId}`,
  );
}

// ---------------------------------------------------------------------------
// Freehold check-ins
// ---------------------------------------------------------------------------

/**
 * Switches a leasehold property's six-monthly freehold check-in on (from
 * today) or off.
 */
export async function setFreeholdAlerts(propertyId: string, on: boolean) {
  const scope = await requireScope();
  const property = await requireProperty(propertyId, scope.householdId);
  if (on && property.ownershipType !== "LEASEHOLD") {
    throw new FormError("Freehold reminders are for leasehold properties");
  }

  await db.property.update({
    where: { id: property.id },
    data: { freeholdAlertsSince: on ? await todayFor(scope.userId) : null },
  });

  revalidatePath(`/properties/${propertyId}`);
}

// ---------------------------------------------------------------------------
// Form twins (see `~/server/form-state`)
// ---------------------------------------------------------------------------

export async function createIssueForm(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  return toFormState(() => createIssue(formData));
}

export async function updateIssueForm(
  issueId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  return toFormState(() => updateIssue(issueId, formData));
}

export async function addKeyDateForm(
  issueId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  return toFormState(() => addKeyDate(issueId, formData));
}

export async function addIssueNoteForm(
  issueId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  return toFormState(() => addIssueNote(issueId, formData));
}

export async function closeIssueForm(
  issueId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  return toFormState(() => closeIssue(issueId, formData));
}

export async function addDuesForm(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  return toFormState(() => addDues(formData));
}

export async function updateDueForm(
  billId: string,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  return toFormState(() => updateDue(billId, formData));
}
