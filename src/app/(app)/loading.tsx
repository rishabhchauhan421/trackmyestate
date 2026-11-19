import clsx from "clsx";

/** A pulsing placeholder bar or block. */
function Bone({ className }: { className?: string }) {
  return (
    <div
      className={clsx("animate-pulse rounded-control bg-sunken-2", className)}
    />
  );
}

/**
 * Shown in the content column the moment a link is clicked, until the page
 * it leads to has loaded its data: the outline of a page header, a stat
 * row and two cards. The sidebar stays in place around it.
 */
export default function Loading() {
  return (
    <div role="status" className="space-y-7">
      <span className="sr-only">Loading…</span>

      <div aria-hidden="true" className="space-y-3">
        <Bone className="h-9 w-64 max-w-full" />
        <Bone className="h-4 w-96 max-w-full" />
      </div>

      <div
        aria-hidden="true"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {[0, 1, 2, 3].map((card) => (
          <div
            key={card}
            className="flex flex-col gap-3 rounded-card border border-line bg-surface px-5 py-5 sm:px-6"
          >
            <Bone className="h-3.5 w-24" />
            <Bone className="h-7 w-32" />
            <Bone className="h-3 w-40 max-w-full" />
          </div>
        ))}
      </div>

      <div aria-hidden="true" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {["lg:col-span-2", ""].map((span, card) => (
          <div
            key={card}
            className={clsx("rounded-card border border-line bg-surface", span)}
          >
            <div className="border-b border-line-soft px-5 py-4 sm:px-6">
              <Bone className="h-4 w-36" />
            </div>
            <div className="space-y-4 p-5 sm:p-6">
              {[0, 1, 2, 3].map((row) => (
                <Bone key={row} className="h-4 w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
