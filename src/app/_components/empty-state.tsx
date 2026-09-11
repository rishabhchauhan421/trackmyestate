import Link from "next/link";
import type { ComponentType, SVGProps } from "react";

export function EmptyState({
  Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
  actionLabel: string;
  /** When provided, the action is a working link instead of a disabled "Coming soon" button. */
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        <Icon className="h-6 w-6" />
      </div>
      <div className="max-w-sm">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      </div>
      {actionHref ? (
        <Link
          href={actionHref}
          className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          {actionLabel}
        </Link>
      ) : (
        <button
          type="button"
          disabled
          title="Coming soon"
          className="mt-2 cursor-not-allowed rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white opacity-40 dark:bg-slate-100 dark:text-slate-900"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
