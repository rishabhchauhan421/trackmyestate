import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { EmptyState } from "~/app/_components/empty-state";
import { InvestmentsIcon } from "~/app/_components/icons";
import { PageHeader } from "~/app/_components/page-header";
import { formatINR } from "~/lib/format";
import { INVESTMENT_TYPE_LABELS } from "~/lib/labels";
import { getSession } from "~/server/better-auth/server";
import { getInvestments } from "~/server/queries/investments";

export default async function InvestmentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const investments = await getInvestments(session.user.id);

  return (
    <>
      <PageHeader
        title="Investments"
        description="FDs, mutual funds, stocks, gold and more — capital deployed alongside current value."
        action={
          <Button href="/investments/new">Add investment</Button>
        }
      />

      {investments.length === 0 ? (
        <EmptyState
          Icon={InvestmentsIcon}
          title="No investments yet"
          description="Add an investment to log its capital deployed, expected return and current estimated value."
          actionLabel="Add your first investment"
          actionHref="/investments/new"
        />
      ) : (
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
                <Link
                  href={`/investments/${investment.id}/edit`}
                  className="mt-4 inline-block text-xs font-medium text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Edit →
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
