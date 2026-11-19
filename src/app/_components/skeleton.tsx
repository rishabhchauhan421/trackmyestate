import clsx from "clsx";

import { SlimLayout } from "./slim-layout";

/** A pulsing placeholder bar or block. */
export function Bone({ className }: { className?: string }) {
  return (
    <div
      className={clsx("animate-pulse rounded-control bg-sunken-2", className)}
    />
  );
}

/**
 * Wraps a placeholder so screen readers hear "Loading…" once instead of a
 * run of empty boxes.
 */
function Placeholder({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">Loading…</span>
      <div aria-hidden="true" className="contents">
        {children}
      </div>
    </div>
  );
}

/** The outline of a page header: title and description. */
export function PageHeaderSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-3">
      <Bone className="h-9 w-64 max-w-full" />
      <Bone className="h-4 w-96 max-w-full" />
    </div>
  );
}

/** The outline of a row of `StatCard`s. */
export function StatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Placeholder className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, card) => (
        <div
          key={card}
          className="flex flex-col gap-3 rounded-card border border-line bg-surface px-5 py-5 sm:px-6"
        >
          <Bone className="h-3.5 w-24" />
          <Bone className="h-7 w-32" />
          <Bone className="h-3 w-40 max-w-full" />
        </div>
      ))}
    </Placeholder>
  );
}

/** The outline of a `Card` with a heading and a few lines. */
export function CardSkeleton({
  rows = 4,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <Placeholder
      className={clsx(
        "block rounded-card border border-line bg-surface",
        className,
      )}
    >
      <div className="border-b border-line-soft px-5 py-4 sm:px-6">
        <Bone className="h-4 w-36" />
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        {Array.from({ length: rows }, (_, row) => (
          <Bone key={row} className="h-4 w-full" />
        ))}
      </div>
    </Placeholder>
  );
}

/** The outline of a list page's rows (policies, loans, documents…). */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Placeholder className="block overflow-hidden rounded-card border border-line bg-surface">
      <div className="divide-y divide-line-soft">
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            className="flex items-center justify-between gap-4 px-5 py-4"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <Bone className="h-4 w-48 max-w-full" />
              <Bone className="h-3 w-32 max-w-full" />
            </div>
            <Bone className="h-4 w-24" />
          </div>
        ))}
      </div>
    </Placeholder>
  );
}

/**
 * A signed-out page (sign up, reset password, an emailed link) while the
 * part that depends on the address is on its way: the real frame and
 * title, with the outline of a short form.
 */
export function SlimLayoutSkeleton({ title }: { title: string }) {
  return (
    <SlimLayout title={title}>
      <Placeholder className="block space-y-5">
        <Bone className="h-11 w-full" />
        <Bone className="h-11 w-full" />
        <Bone className="h-11 w-full" />
      </Placeholder>
    </SlimLayout>
  );
}
