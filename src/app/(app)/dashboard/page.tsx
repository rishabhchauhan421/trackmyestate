import Link from "next/link";
import { redirect } from "next/navigation";

import { AlertIcon, ArrowRightIcon } from "~/app/_components/icons";
import { navItems } from "~/app/_components/nav";
import { PageHeader } from "~/app/_components/page-header";
import { formatDate, formatINR } from "~/lib/format";
import { getSession } from "~/server/better-auth/server";
import { getDashboardData } from "~/server/queries/dashboard";

const quickLinks = navItems.filter((item) => item.href !== "/dashboard");

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {stat.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-50">
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {stat.hint}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <AlertIcon className="h-5 w-5 text-amber-500" />
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Needs attention
          </h2>
        </div>
        {attentionItems.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Nothing overdue or due in the next 7 days. You&apos;re all caught
            up.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {attentionItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {item.description ?? CATEGORY_LABELS[item.category]}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {item.status === "OVERDUE" ? "Overdue" : "Due"}{" "}
                    {formatDate(item.dueDate)}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold ${
                    item.status === "OVERDUE"
                      ? "text-red-600 dark:text-red-400"
                      : "text-slate-800 dark:text-slate-100"
                  }`}
                >
                  {formatINR(item.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
          Jump into a module
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map(({ label, href, description, Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-blue-300 hover:bg-blue-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-800 dark:hover:bg-blue-500/5"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {label}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {description}
                  </p>
                </div>
              </div>
              <ArrowRightIcon className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600 dark:text-slate-600" />
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
