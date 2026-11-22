import "server-only";

import { db } from "~/server/db";
import { NOT_SOFT_DELETED } from "~/server/queries/shared";

/**
 * `Bill`s for a property, scoped to one category — the generic query
 * primitive behind the (still per-domain) UI pages. Category-specific
 * enrichment — e.g. utility type/provider — is layered on top by the caller,
 * not here.
 */
export async function getBillsForProperty(
  propertyId: string,
  category: "UTILITY_BILL" | "RENT",
) {
  return db.bill.findMany({
    where: { propertyId, category },
    orderBy: { dueDate: "desc" },
  });
}

/**
 * Every `Bill` tied to a property, across every category — utility bills
 * and rent (both carry `propertyId` directly) plus EMI bills from any
 * `Loan` linked to this property via `Loan.linkedPropertyId` (an EMI
 * `Bill` only ever carries `loanId`, never `propertyId` — see the `Bill`
 * model comment in `schema.prisma` — so those are pulled in through the
 * loan instead). Newest due date first, for the property detail page's
 * "Open bills" section.
 */
export async function getAllBillsForProperty(propertyId: string) {
  const linkedLoans = await db.loan.findMany({
    where: { linkedPropertyId: propertyId },
    select: { id: true },
  });
  const loanIds = linkedLoans.map((loan) => loan.id);

  return db.bill.findMany({
    where: {
      OR: [
        { propertyId },
        ...(loanIds.length > 0 ? [{ loanId: { in: loanIds } }] : []),
      ],
    },
    orderBy: { dueDate: "desc" },
  });
}

/**
 * One bill in the household, with what it belongs to (for its title and
 * a link back) and the payments recorded against it, oldest first — for
 * the bill page (`/bills/[id]`). `null` if it isn't in this household.
 */
export async function getBillForHousehold(billId: string, householdId: string) {
  return db.bill.findFirst({
    where: { id: billId, householdId },
    include: {
      property: { select: { id: true, name: true } },
      lease: { select: { id: true, tenantName: true, propertyId: true } },
      loan: { select: { id: true, lender: true } },
      policy: { select: { id: true, insurer: true, policyNumber: true } },
      investment: { select: { id: true, name: true } },
      propertyIssue: { select: { id: true, title: true, propertyId: true } },
      billSchedule: {
        select: { id: true, billType: true, provider: true, billingType: true },
      },
      transactions: {
        where: NOT_SOFT_DELETED,
        orderBy: { paidAt: "asc" },
      },
    },
  });
}

export type BillWithContext = NonNullable<
  Awaited<ReturnType<typeof getBillForHousehold>>
>;
