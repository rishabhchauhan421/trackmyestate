import "server-only";

import { db } from "~/server/db";
import { NOT_SOFT_DELETED, OPEN_PAYMENT_STATUSES } from "~/server/queries/shared";

/**
 * Loans for the Loans page, each with its next open EMI `Bill`, if any.
 * Batch-fetched and grouped in application code — same rationale as
 * `getProperties`. Deleted loans (see `deleteLoan` in
 * `~/server/actions/loans`) are excluded.
 */
export async function getLoans(ownerId: string) {
  const loans = await db.loan.findMany({
    where: { ownerId, ...NOT_SOFT_DELETED },
    orderBy: { createdAt: "asc" },
  });

  const loanIds = loans.map((loan) => loan.id);
  const openEmis = loanIds.length
    ? await db.bill.findMany({
        where: {
          category: "EMI",
          loanId: { in: loanIds },
          status: { in: [...OPEN_PAYMENT_STATUSES] },
        },
        orderBy: { dueDate: "asc" },
      })
    : [];

  const nextEmiByLoan = new Map<string, (typeof openEmis)[number]>();
  for (const bill of openEmis) {
    if (!nextEmiByLoan.has(bill.loanId!)) {
      nextEmiByLoan.set(bill.loanId!, bill);
    }
  }

  const linkedPropertyIds = [
    ...new Set(
      loans
        .map((loan) => loan.linkedPropertyId)
        .filter((propertyId): propertyId is string => propertyId != null),
    ),
  ];
  const linkedProperties = linkedPropertyIds.length
    ? await db.property.findMany({
        where: { id: { in: linkedPropertyIds } },
        select: { id: true, name: true },
      })
    : [];
  const propertyNameById = new Map(
    linkedProperties.map((property) => [property.id, property.name]),
  );

  return loans.map((loan) => ({
    ...loan,
    nextEmi: nextEmiByLoan.get(loan.id) ?? null,
    linkedPropertyName: loan.linkedPropertyId
      ? (propertyNameById.get(loan.linkedPropertyId) ?? null)
      : null,
  }));
}

/**
 * A single `Loan`, scoped to `ownerId` — for the edit page. Returns `null`
 * for a nonexistent loan *or* one owned by someone else, same rationale as
 * `getPropertyForOwner`. Its EMI schedule lives on a separate `BillSchedule`
 * row (category `"EMI"`) — see the model comment in `schema.prisma` — so
 * it's fetched and flattened back onto the returned loan under its old
 * field names (`tenureMonths`/`emiAmount`/`emiDueDay`), keeping the edit
 * page's field access unchanged.
 */
export async function getLoanForOwner(loanId: string, ownerId: string) {
  const loan = await db.loan.findFirst({
    where: { id: loanId, ownerId, ...NOT_SOFT_DELETED },
  });
  if (!loan) return null;

  const schedule = await db.billSchedule.findFirst({
    where: { category: "EMI", loanId },
  });

  // Every Loan gets its EMI BillSchedule created alongside it in
  // createLoan, so this should never actually be null.
  return {
    ...loan,
    tenureMonths: schedule!.tenureMonths!,
    emiAmount: schedule!.defaultAmount!,
    emiDueDay: schedule!.dueDay,
  };
}

/**
 * Whether any `Bill` has ever been generated for this loan (an EMI payment
 * on record). A loan with billing history can't be deleted — see
 * `deleteLoan` in `~/server/actions/loans` — same rationale as
 * `hasBillsForLease`.
 */
export async function hasBillsForLoan(loanId: string) {
  const bill = await db.bill.findFirst({
    where: { loanId },
    select: { id: true },
  });
  return bill != null;
}
