import { redirect } from "next/navigation";

import { EmptyState } from "~/app/_components/empty-state";
import { InvestmentsIcon } from "~/app/_components/icons";
import { PageHeader } from "~/app/_components/page-header";
import { formatDate, formatINR } from "~/lib/format";
import { getSession } from "~/server/better-auth/server";
import { getInvestments, getLoans } from "~/server/queries";

const INVESTMENT_TYPE_LABELS: Record<string, string> = {
  PROPERTY: "Property",
  FIXED_DEPOSIT: "Fixed deposit",
  RECURRING_DEPOSIT: "Recurring deposit",
  MUTUAL_FUND: "Mutual fund",
  STOCKS: "Stocks",
  GOLD: "Gold",
  BUSINESS: "Business",
  PPF: "PPF",
  NPS: "NPS",
};

const LOAN_TYPE_LABELS: Record<string, string> = {
  HOME_LOAN: "Home loan",
  LOAN_AGAINST_PROPERTY: "Loan against property",
  PERSONAL_LOAN: "Personal loan",
  VEHICLE_LOAN: "Vehicle loan",
  EDUCATION_LOAN: "Education loan",
  GOLD_LOAN: "Gold loan",
};

export default async function InvestmentsPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const [investments, loans] = await Promise.all([
    getInvestments(session.user.id),
    getLoans(session.user.id),
  ]);

  const hasData = investments.length > 0 || loans.length > 0;

  return (
    <>
      <PageHeader
        title="Investments & Loans"
        description="FDs, mutual funds, stocks and gold alongside loans and EMIs, with amortization built in."
        action={
          <button
            type="button"
            disabled
            title="Coming soon"
            className="cursor-not-allowed rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white opacity-40"
          >
            Add investment or loan
          </button>
        }
      />

      {!hasData ? (
        <EmptyState
          Icon={InvestmentsIcon}
          title="Nothing tracked yet"
          description="Add an investment to log expected returns, or a loan to get an auto-generated EMI and amortization schedule feeding your timeline."
          actionLabel="Add your first entry"
        />
      ) : (
        <>
          {investments.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                Investments
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {investments.map((investment) => {
                  const gain =
                    investment.currentEstimatedValue != null
                      ? investment.currentEstimatedValue -
                        investment.capitalDeployed
                      : null;
                  return (
                    <div
                      key={investment.id}
                      className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                          {investment.name}
                        </p>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          {INVESTMENT_TYPE_LABELS[investment.type]}
                        </span>
                      </div>
                      <p className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-50">
                        {investment.currentEstimatedValue
                          ? formatINR(investment.currentEstimatedValue)
                          : formatINR(investment.capitalDeployed)}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {formatINR(investment.capitalDeployed)} deployed
                        {gain != null && (
                          <span
                            className={
                              gain >= 0
                                ? " text-emerald-600 dark:text-emerald-400"
                                : " text-red-600 dark:text-red-400"
                            }
                          >
                            {" "}
                            ({gain >= 0 ? "+" : ""}
                            {formatINR(gain)})
                          </span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {loans.length > 0 && (
            <div>
              <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                Loans
              </h2>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loans.map((loan) => {
                    const nextEmi = loan.emiPayments[0];
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
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
