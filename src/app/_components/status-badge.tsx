const STATUS_STYLES: Record<string, string> = {
  PAID: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  DUE: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  OVERDUE: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  PARTIALLY_PAID:
    "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  CANCELLED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  REFUNDED: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  LAPSED: "bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300",
  MATURED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  CLAIMED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

const FALLBACK_STYLE =
  "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        STATUS_STYLES[status] ?? FALLBACK_STYLE
      }`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
