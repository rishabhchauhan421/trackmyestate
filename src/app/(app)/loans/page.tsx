import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { EmptyState } from "~/app/_components/empty-state";
import { LoansIcon } from "~/app/_components/icons";
import { PageHeader } from "~/app/_components/page-header";
import { formatDate, formatINR } from "~/lib/format";
import { LOAN_TYPE_LABELS } from "~/lib/labels";
import { getSession } from "~/server/better-auth/server";
import { getLoans } from "~/server/queries/loans";

export default async function LoansPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const loans = await getLoans(session.user.id);

  return (
    <>
      <PageHeader
        title="Loans"
        description="Home loans, personal loans and more — EMI, amortization and outstanding balance."
        action={
          <Button href="/loans/new">Add loan</Button>
        }
      />

      {loans.length === 0 ? (
        <EmptyState
          Icon={LoansIcon}
          title="No loans yet"
          description="Add a loan to get an EMI and amortization schedule feeding your timeline."
          actionLabel="Add your first loan"
          actionHref="/loans/new"
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {loans.map((loan) => {
              const nextEmi = loan.nextEmi;
              return (
                <li
                  key={loan.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {loan.lender}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {LOAN_TYPE_LABELS[loan.type]} ·{" "}
                      {loan.interestRatePercent}% p.a.
                      {loan.linkedPropertyName && (
                        <> · linked to {loan.linkedPropertyName}</>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {formatINR(loan.outstandingBalance)}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      outstanding
                    </p>
                  </div>
                  {nextEmi && (
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {formatINR(nextEmi.amount)}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        EMI due {formatDate(nextEmi.dueDate)}
                      </p>
                    </div>
                  )}
                  <Link
                    href={`/loans/${loan.id}/edit`}
                    className="shrink-0 text-xs font-medium text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
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
