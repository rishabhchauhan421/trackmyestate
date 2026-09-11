import Link from "next/link";

import { AlertIcon, ArrowRightIcon } from "~/app/_components/icons";
import { navItems } from "~/app/_components/nav";
import { PageHeader } from "~/app/_components/page-header";

const stats = [
  { label: "Net worth", value: "—", hint: "Assets minus liabilities" },
  { label: "Total coverage", value: "—", hint: "Across all policies" },
  { label: "Upcoming outflows", value: "—", hint: "Next 30 days" },
  { label: "Expected inflows", value: "—", hint: "Next 30 days" },
];

const quickLinks = navItems.filter((item) => item.href !== "/dashboard");

export default function DashboardPage() {
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
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Lapsing policies, overdue bills and EMIs will show up here the
          moment you add your first asset.
        </p>
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
              className="group flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-800 dark:hover:bg-emerald-500/5"
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
              <ArrowRightIcon className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600 dark:text-slate-600" />
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
