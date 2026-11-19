import { Suspense } from "react";
import { ListSkeleton } from "~/app/_components/skeleton";
import Link from "next/link";
import { Button } from "~/app/_components/button";
import { EmptyState } from "~/app/_components/empty-state";
import { NextDue } from "~/app/_components/next-due";
import { LoansIcon } from "~/app/_components/icons";
import { PageHeader } from "~/app/_components/page-header";
import { formatMoney } from "~/lib/format";
import { LOAN_TYPE_LABELS } from "~/lib/labels";
import { requireScope } from "~/server/households";
import { getUserCurrency, getUserTimeZone } from "~/server/queries/settings";
import { getLoans } from "~/server/queries/loans";

async function LoansContent() {
  const scope = await requireScope();
  const [currency, timeZone] = await Promise.all([
    getUserCurrency(scope.userId),
    getUserTimeZone(scope.userId),
  ]);
  const loans = await getLoans(scope.householdId, timeZone);

  return (
    <>
      {loans.length === 0 ? (
        <EmptyState
          Icon={LoansIcon}
          title="No loans yet"
          description="Add a loan to get an EMI and amortization schedule feeding your timeline."
          actionLabel="Add your first loan"
          actionHref="/loans/new"
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <ul className="divide-y divide-line-soft">
            {loans.map((loan) => {
              const nextEmi = loan.nextEmi;
              return (
                <li
                  key={loan.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {loan.lender}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {LOAN_TYPE_LABELS[loan.type]} · {loan.interestRatePercent}
                      % p.a.
                      {loan.linkedPropertyName && (
                        <> · linked to {loan.linkedPropertyName}</>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink">
                      {formatMoney(
                        loan.outstandingBalance,
                        loan.currency ?? currency,
                      )}
                    </p>
                    <p className="text-xs text-muted">outstanding</p>
                  </div>
                  {nextEmi && (
                    <NextDue
                      label="Next EMI"
                      dueDate={nextEmi.dueDate}
                      amount={nextEmi.amount}
                      currency={loan.currency ?? currency}
                      timeZone={timeZone}
                    />
                  )}
                  <Link
                    href={`/loans/${loan.id}/edit`}
                    className="shrink-0 text-xs font-medium text-accent hover:text-accent-strong"
                  >
                    Edit →
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}

/**
 * The header is the same for everyone, so it is prerendered and shows the
 * moment the page is opened; the data streams in beneath it.
 */
export default function LoansPage() {
  return (
    <>
      <PageHeader
        title="Loans"
        description="Home loans, personal loans and more — EMI, amortization and outstanding balance."
        action={<Button href="/loans/new">Add loan</Button>}
      />

      <Suspense fallback={<ListSkeleton />}>
        <LoansContent />
      </Suspense>
    </>
  );
}
