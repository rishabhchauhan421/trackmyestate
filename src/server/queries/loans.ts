import "server-only";

import { db } from "~/server/db";
import { OPEN_PAYMENT_STATUSES } from "~/server/queries/shared";

/**
 * Loans for the Loans page, each with its next open EMI `Bill`, if any.
 * Batch-fetched and grouped in application code — same rationale as
 * `getProperties`.
 */
export async function getLoans(ownerId: string) {
  const loans = await db.loan.findMany({
    where: { ownerId },
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

  return loans.map((loan) => ({
    ...loan,
    nextEmi: nextEmiByLoan.get(loan.id) ?? null,
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
  const loan = await db.loan.findFirst({ where: { id: loanId, ownerId } });
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
