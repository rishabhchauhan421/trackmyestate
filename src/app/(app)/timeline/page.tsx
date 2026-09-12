import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "~/app/_components/empty-state";
import { TimelineIcon } from "~/app/_components/icons";
import { PageHeader } from "~/app/_components/page-header";
import { StatusBadge } from "~/app/_components/status-badge";
import { formatDate, formatINR } from "~/lib/format";
import { getSession } from "~/server/better-auth/server";
import {
  getTimelineEvents,
  type TimelineFilter,
  type TimelineRange,
} from "~/server/queries/timeline";

const RANGE_TABS: { value: TimelineRange; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

const FILTER_TABS: { value: TimelineFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "inflow", label: "Inflows" },
  { value: "outflow", label: "Outflows" },
];

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

function isRange(value: string | undefined): value is TimelineRange {
  return value === "month" || value === "quarter" || value === "year";
}

function isFilter(value: string | undefined): value is TimelineFilter {
  return value === "all" || value === "inflow" || value === "outflow";
}

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawRange = params.range;
  const rawFilter = params.filter;
  const range = isRange(
    typeof rawRange === "string" ? rawRange : undefined,
  )
    ? (rawRange as TimelineRange)
    : "month";
  const filter = isFilter(
    typeof rawFilter === "string" ? rawFilter : undefined,
  )
    ? (rawFilter as TimelineFilter)
    : "all";

  const session = await getSession();
  if (!session) redirect("/login");
  const events = await getTimelineEvents(session.user.id, range, filter);

  return (
    <>
      <PageHeader
        title="Timeline"
        description="What do I pay this month, and what money is coming back to me — and when."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          {RANGE_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={`/timeline?range=${tab.value}&filter=${filter}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                tab.value === range
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <div className="inline-flex gap-2">
          {FILTER_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={`/timeline?range=${range}&filter=${tab.value}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                tab.value === filter
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {events.length === 0 ? (
        <EmptyState
          Icon={TimelineIcon}
          title="No financial events yet"
          description="Add a property, policy, investment or loan and every rent, premium, EMI and payout will land here automatically, dated and net."
          actionLabel="Export CSV / PDF"
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {event.description ?? CATEGORY_LABELS[event.category]}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(event.dueDate)} · {CATEGORY_LABELS[event.category]}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge status={event.status} />
                  <span
                    className={`w-28 text-right text-sm font-semibold ${
                      event.direction === "INFLOW"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-800 dark:text-slate-100"
                    }`}
                  >
                    {event.direction === "INFLOW" ? "+" : "-"}
                    {formatINR(event.amount)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
