import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { MenuIcon } from "~/app/_components/icons";
import { Logo } from "~/app/_components/logo";
import { auth } from "~/server/better-auth";
import type { getSession } from "~/server/better-auth/server";

const navItems = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

const navLinkClass =
  "rounded-control px-3 py-2 text-sm font-medium text-ink-2 transition-colors hover:bg-sunken-2 hover:text-ink";

/**
 * The marketing homepage's own header — not the signed-in app's sidebar
 * (see `app-shell.tsx`). Session-aware: shows a "Sign in" link (to the
 * dedicated `/login` page, which offers both email/password and Google) or
 * a dashboard/sign-out pair. The mobile menu is a `<details>` disclosure,
 * so it needs no client JS.
 */
export function SiteHeader({
  session,
}: {
  session: Awaited<ReturnType<typeof getSession>>;
}) {
  return (
    <header className="mx-auto flex max-w-300 items-center justify-between gap-4 px-4 py-5 sm:px-8">
      <Link href="/" aria-label="TrackMyEstate home" className="text-ink">
        <Logo />
      </Link>

      <nav aria-label="Site" className="hidden items-center gap-1 md:flex">
        {navItems.map((item) => (
          <a key={item.href} href={item.href} className={navLinkClass}>
            {item.label}
          </a>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        {session ? (
          <>
            <form data-gtm-event="sign_out" className="hidden sm:block">
              <button
                formAction={async () => {
                  "use server";
                  await auth.api.signOut({ headers: await headers() });
                  redirect("/");
                }}
                className={navLinkClass}
              >
                Sign out
              </button>
            </form>
            <Button href="/dashboard" color="slate" size="sm">
              Open dashboard
            </Button>
          </>
        ) : (
          <>
            <Link href="/login" className={`${navLinkClass} hidden sm:block`}>
              Sign in
            </Link>
            <Button href="/login" color="slate" className="max-sm:hidden">
              Get started free
            </Button>
          </>
        )}

        <details className="relative md:hidden">
          <summary
            className="flex size-11 cursor-pointer list-none items-center justify-center rounded-control text-ink-2 hover:bg-sunken-2 [&::-webkit-details-marker]:hidden"
            aria-label="Toggle navigation"
          >
            <MenuIcon className="size-5" />
          </summary>
          <nav className="absolute top-full right-0 z-50 mt-2 flex w-52 flex-col gap-0.5 rounded-card border border-line bg-surface p-2 shadow-xl">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className={navLinkClass}>
                {item.label}
              </a>
            ))}
            {!session && (
              <>
                <Link href="/login" className={navLinkClass}>
                  Sign in
                </Link>
                <Button href="/login" color="slate" className="mt-1 sm:hidden">
                  Get started free
                </Button>
              </>
            )}
          </nav>
        </details>
      </div>
    </header>
  );
}
