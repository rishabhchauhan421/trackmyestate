import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "./logo";

/** Example rows for the decorative panel — illustrative only. */
const previewRows = [
  {
    when: "In 3 days",
    what: "Mediclaim premium",
    amount: "₹18,900",
    tone: "warn",
  },
  { when: "5 Nov", what: "Home loan EMI", amount: "₹71,250", tone: "plain" },
  { when: "7 Nov", what: "Rent in", amount: "+₹32,000", tone: "in" },
] as const;

/**
 * Auth-page shell (sign in, forgot/reset password): the form column on the
 * left with the page's `title`/`description`, and a decorative brand panel
 * on the right from `lg` up.
 */
export function SlimLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-svh bg-ground">
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-100 space-y-7">
          <Link
            href="/"
            aria-label="TrackMyEstate home"
            className="inline-block text-ink"
          >
            <Logo />
          </Link>
          <div className="space-y-2">
            <h1 className="font-display text-[1.875rem] leading-tight font-semibold tracking-[-0.02em] text-ink">
              {title}
            </h1>
            {description && (
              <p className="text-[0.9375rem] text-muted">{description}</p>
            )}
          </div>
          {children}
        </div>
      </main>

      <aside
        aria-hidden="true"
        className="hidden flex-1 items-center justify-center bg-night p-12 text-white lg:flex"
      >
        <div className="max-w-md space-y-7">
          <p className="font-display text-[2.125rem] leading-tight font-semibold tracking-[-0.02em]">
            Every premium, EMI and rent date —{" "}
            <span className="text-mint">before it&apos;s due.</span>
          </p>
          <div className="space-y-2.5 rounded-[18px] bg-night-2 p-4">
            {previewRows.map((row) => (
              <div
                key={row.what}
                className="flex items-center gap-3 rounded-xl bg-night-3 px-3 py-3"
              >
                <span
                  className={`w-16 text-[0.6875rem] font-bold uppercase ${
                    row.tone === "warn"
                      ? "text-[#f2b544]"
                      : row.tone === "in"
                        ? "text-mint"
                        : "text-night-ink"
                  }`}
                >
                  {row.when}
                </span>
                <span className="flex-1 text-sm">{row.what}</span>
                <span
                  className={`text-sm font-semibold ${row.tone === "in" ? "text-mint" : ""}`}
                >
                  {row.amount}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[0.8125rem] text-night-ink">
            Encrypted documents · never shared · free to start
          </p>
        </div>
      </aside>
    </div>
  );
}
