import { useId } from "react";
import type { ComponentPropsWithoutRef } from "react";

const inputClass =
  "block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-blue-400 dark:focus:bg-slate-800";

/** A labeled text input, associated via `useId` — used on the login page's form. */
export function TextField({
  label,
  className,
  ...props
}: Omit<ComponentPropsWithoutRef<"input">, "id"> & { label: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        {label}
      </label>
      <input id={id} {...props} className={inputClass} />
    </div>
  );
}
