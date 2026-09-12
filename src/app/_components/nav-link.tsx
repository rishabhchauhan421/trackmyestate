import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

/** A text nav link for the marketing site header/footer — not the app's own sidebar (see `app-shell.tsx`). */
export function NavLink({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link
      {...props}
      className={`inline-block rounded-lg px-2 py-1 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100 ${className ?? ""}`}
    />
  );
}
