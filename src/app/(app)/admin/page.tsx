import { PageHeader } from "~/app/_components/page-header";
import { formatINR } from "~/lib/format";
import { NOTIFICATION_STATUS_LABELS } from "~/lib/labels";
import { getAdminOverview } from "~/server/queries/admin";

export default async function AdminOverviewPage() {
  const overview = await getAdminOverview();

  const stats = [
    {
      label: "Total users",
      value: overview.users.total.toLocaleString("en-IN"),
      hint: `${overview.users.new7d} new in the last 7 days`,
    },
    {
      label: "New users",
      value: overview.users.new30d.toLocaleString("en-IN"),
      hint: "Last 30 days",
    },
    {
      label: "Tracked portfolio value",
      value: formatINR(overview.trackedValue),
      hint: "Property + investments, minus loans — every user",
    },
    {
      label: "Active notification rules",
      value: overview.activeNotificationRules.toLocaleString("en-IN"),
      hint: `${overview.users.banned} user${overview.users.banned === 1 ? "" : "s"} banned`,
    },
  ];

  const assetCounts = [
    { label: "Properties", value: overview.assetCounts.properties },
    { label: "Investments", value: overview.assetCounts.investments },
    { label: "Loans", value: overview.assetCounts.loans },
    { label: "Policies", value: overview.assetCounts.policies },
    { label: "Documents", value: overview.assetCounts.documents },
  ];

  return (
    <>
      <PageHeader
        title="Admin overview"
        description="Platform-wide numbers across every user — not just yours."
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Assets tracked
            </h2>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {assetCounts.map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between px-6 py-3 text-sm"
              >
                <span className="text-slate-600 dark:text-slate-300">{row.label}</span>
                <span className="font-medium text-slate-900 dark:text-slate-50">
                  {row.value.toLocaleString("en-IN")}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Notification engine
            </h2>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {Object.entries(overview.notificationsByStatus).map(
              ([status, count]) => (
                <li
                  key={status}
                  className="flex items-center justify-between px-6 py-3 text-sm"
                >
                  <span className="text-slate-600 dark:text-slate-300">
                    {NOTIFICATION_STATUS_LABELS[
                      status as keyof typeof NOTIFICATION_STATUS_LABELS
                    ] ?? status}
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-50">
                    {count.toLocaleString("en-IN")}
                  </span>
                </li>
              ),
            )}
          </ul>
        </div>
      </div>
    </>
  );
}
