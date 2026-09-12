import { redirect } from "next/navigation";

import { AlertIcon } from "~/app/_components/icons";
import { PageHeader } from "~/app/_components/page-header";
import { StatusBadge } from "~/app/_components/status-badge";
import { formatDate, formatINR } from "~/lib/format";
import { getSession } from "~/server/better-auth/server";
import { getDashboardData } from "~/server/queries/dashboard";

const CATEGORY_LABELS: Record<string, string> = {
  RENT: "Rent",
  UTILITY_BILL: "Bill",
  PREMIUM: "Premium",
  PAYOUT: "Payout",
  EMI: "EMI",
  INVESTMENT_RETURN: "Return",
  CLAIM_SETTLEMENT: "Claim settlement",
  CUSTOM: "Custom",
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const {
    netWorth,
    totalCoverage,
    upcomingOutflows,
    expectedInflows,
    attentionItems,
  } = await getDashboardData(session.user.id);

  const stats = [
    {
      label: "Net worth",
      value: formatINR(netWorth),
      hint: "Assets minus liabilities",
    },
    {
      label: "Total coverage",
      value: formatINR(totalCoverage),
      hint: "Across all policies",
    },
    {
      label: "Upcoming outflows",
      value: formatINR(upcomingOutflows),
      hint: "Next 30 days",
    },
    {
      label: "Expected inflows",
      value: formatINR(expectedInflows),
      hint: "Next 30 days",
    },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your whole portfolio, at a glance — and what needs your attention."
      />

      <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="border-t border-slate-200 pt-4 dark:border-slate-800">
            <p className="text-sm/6 font-medium text-slate-500 dark:text-slate-400">
              {stat.label}
            </p>
            <p className="mt-2 text-3xl/8 font-semibold text-slate-900 dark:text-slate-50">
              {stat.value}
            </p>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              {stat.hint}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <AlertIcon className="h-5 w-5 text-amber-500" />
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Needs attention
          </h2>
        </div>
        {attentionItems.length === 0 ? (
          <p className="px-6 py-6 text-sm text-slate-500 dark:text-slate-400">
            Nothing overdue or due in the next 7 days. You&apos;re all caught
            up.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {attentionItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 px-6 py-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <StatusBadge status={item.status} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {item.description ?? CATEGORY_LABELS[item.category]}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Due {formatDate(item.dueDate)}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {formatINR(item.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
