import type { ReactNode } from "react";

import { AlertIcon, SearchIcon } from "~/app/_components/icons";

/**
 * The body of an error or "not found" page: an icon, what happened, and
 * what to do next (`actions`). Shared by the `error.tsx` and
 * `not-found.tsx` files so they look the same everywhere.
 */
export function ProblemPanel({
  kind,
  title,
  description,
  actions,
}: {
  kind: "error" | "not-found";
  title: string;
  description: ReactNode;
  actions: ReactNode;
}) {
  const Icon = kind === "error" ? AlertIcon : SearchIcon;
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-6 py-16 text-center">
      <div
        className={`flex size-12 items-center justify-center rounded-full ${
          kind === "error"
            ? "bg-danger-soft text-danger"
            : "bg-accent-soft text-accent"
        }`}
      >
        <Icon className="size-6" />
      </div>
      <div className="max-w-sm">
        <h1 className="text-base font-semibold text-ink">{title}</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-3">{actions}</div>
    </div>
  );
}
