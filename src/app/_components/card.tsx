import clsx from "clsx";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

/** The white panel every app section sits in. */
export function Card({
  className,
  ...props
}: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      {...props}
      className={clsx(
        "overflow-hidden rounded-card border border-line bg-surface",
        className,
      )}
    />
  );
}

/** A card's title row, with an optional link or button on the right. */
export function CardHeader({
  title,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex items-center justify-between gap-3 border-b border-line-soft px-5 py-4 sm:px-6",
        className,
      )}
    >
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
        {icon}
        {title}
      </h2>
      {action && (
        <div className="text-[0.8125rem] font-medium text-accent">{action}</div>
      )}
    </div>
  );
}

/**
 * A headline figure: label, value, and a short supporting line. `tone`
 * `"dark"` is the one emphasised stat per row (e.g. net worth).
 */
export function StatCard({
  label,
  value,
  hint,
  tone = "light",
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "light" | "dark";
  valueClassName?: string;
}) {
  const dark = tone === "dark";
  return (
    <div
      className={clsx(
        "flex flex-col gap-2.5 rounded-card px-5 py-5 sm:px-6",
        dark ? "bg-night text-white" : "border border-line bg-surface",
      )}
    >
      <span
        className={clsx(
          "text-[0.8125rem]",
          dark ? "text-night-ink" : "text-muted",
        )}
      >
        {label}
      </span>
      <span
        className={clsx(
          "font-display text-[1.75rem] leading-none font-semibold tracking-[-0.02em]",
          valueClassName,
        )}
      >
        {value}
      </span>
      {hint && (
        <span
          className={clsx("text-xs", dark ? "text-night-ink" : "text-muted")}
        >
          {hint}
        </span>
      )}
    </div>
  );
}
