import clsx from "clsx";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * Building blocks for the app's forms, so every add/edit page shares one
 * look: grouped `FormSection` cards, labelled fields and a right-aligned
 * `FormActions` row.
 */

/** Shared look for `<input>`, `<select>` and `<textarea>`. */
export const controlClass =
  "mt-1.5 block w-full rounded-control border border-line-strong bg-surface px-3.5 py-2.5 text-[0.9375rem] text-ink shadow-none placeholder:text-muted/80 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none disabled:bg-sunken disabled:text-muted";

/** The field's label text (rendered as a `<span>` inside a wrapping `<label>`). */
export const labelClass = "block text-sm font-medium text-ink";

/**
 * Wraps a label and its control in one `<label>`, which associates them
 * without ids. `optional` adds a muted "· optional" after the label.
 */
export function Field({
  label,
  optional = false,
  hint,
  className,
  children,
}: {
  label: ReactNode;
  optional?: boolean;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={clsx("block", className)}>
      <span className={labelClass}>
        {label}
        {optional && (
          <span className="font-normal text-muted"> · optional</span>
        )}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Input({
  className,
  ...props
}: ComponentPropsWithoutRef<"input">) {
  return <input {...props} className={clsx(controlClass, className)} />;
}

export function Select({
  className,
  ...props
}: ComponentPropsWithoutRef<"select">) {
  return <select {...props} className={clsx(controlClass, className)} />;
}

/** A number input with a "₹" prefix, for amounts. */
export function MoneyInput({
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<"input">, "type">) {
  return (
    <span
      className={clsx(
        "mt-1.5 flex overflow-hidden rounded-control border border-line-strong bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20",
        className,
      )}
    >
      <span className="flex items-center border-r border-line bg-sunken px-3 text-[0.9375rem] text-muted">
        ₹
      </span>
      <input
        type="number"
        min="0"
        step="any"
        {...props}
        className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-[0.9375rem] text-ink placeholder:text-muted/80 focus:ring-0 focus:outline-none"
      />
    </span>
  );
}

/** A titled card grouping related fields. */
export function FormSection({
  title,
  description,
  optional = false,
  children,
  className,
}: {
  title: string;
  description?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset
      className={clsx(
        "min-w-0 rounded-card border border-line bg-surface p-5 sm:p-6",
        className,
      )}
    >
      <legend className="float-left w-full">
        <span className="text-base font-semibold text-ink">
          {title}
          {optional && (
            <span className="text-sm font-normal text-muted"> · optional</span>
          )}
        </span>
        {description && (
          <span className="mt-1 block text-sm text-muted">{description}</span>
        )}
      </legend>
      <div className="clear-both space-y-5 pt-5">{children}</div>
    </fieldset>
  );
}

/** Right-aligned submit/cancel row under a form. */
export function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
      {children}
    </div>
  );
}

/** An inline success/error message above a form. */
export function Notice({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={clsx(
        "rounded-control px-3.5 py-2.5 text-sm",
        tone === "error" ? "bg-danger-soft text-danger" : "bg-ok-soft text-ok",
      )}
    >
      {children}
    </p>
  );
}

/**
 * A radio group drawn as large, tappable cards — for a short list of
 * mutually exclusive choices that deserve more weight than a `<select>`.
 */
export function ChoiceCards({
  legend,
  name,
  options,
  defaultValue,
  required = false,
}: {
  legend: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <fieldset>
      <legend className={labelClass}>{legend}</legend>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex min-h-12 cursor-pointer items-center gap-2.5 rounded-control border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink transition-colors hover:border-accent/60 has-checked:border-accent has-checked:bg-accent-soft has-checked:font-semibold has-checked:ring-1 has-checked:ring-accent has-focus-visible:ring-2 has-focus-visible:ring-accent/40"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={option.value === defaultValue}
              required={required}
              className="size-4.5 border-line-strong text-accent focus:ring-accent"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
