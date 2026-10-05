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
  const actionClass =
    "mt-2 inline-flex h-11 items-center rounded-control bg-accent px-5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-strong";

  return (
    <div className="flex flex-col items-center gap-3 rounded-card border-[1.5px] border-dashed border-line-strong bg-surface px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon className="size-6" />
      </div>
      <div className="max-w-sm">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
      </div>
      {actionHref ? (
        <Link href={actionHref} className={actionClass}>
          {actionLabel}
        </Link>
      ) : (
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            disabled
            title="Coming soon"
            className={`${actionClass} cursor-not-allowed opacity-40`}
          >
            {actionLabel}
          </button>
          <span className="text-xs font-medium text-muted">Coming soon</span>
        </div>
      )}
    </div>
  );
}
