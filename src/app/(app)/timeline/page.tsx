import { TimelineIcon } from "~/app/_components/icons";
import { EmptyState } from "~/app/_components/empty-state";
import { PageHeader } from "~/app/_components/page-header";

const rangeTabs = ["Month", "Quarter", "Year"];
const filters = ["All", "Inflows", "Outflows"];

export default function TimelinePage() {
  return (
    <>
      <PageHeader
        title="Timeline"
        description="What do I pay this month, and what money is coming back to me — and when."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
          {rangeTabs.map((tab, i) => (
            <span
              key={tab}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                i === 0
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {tab}
            </span>
          ))}
        </div>
        <div className="inline-flex gap-2">
          {filters.map((filter, i) => (
            <span
              key={filter}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                i === 0
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {filter}
            </span>
          ))}
        </div>
      </div>

      <EmptyState
        Icon={TimelineIcon}
        title="No financial events yet"
        description="Add a property, policy, investment or loan and every rent, premium, EMI and payout will land here automatically, dated and net."
        actionLabel="Export CSV / PDF"
      />
    </>
  );
}
