import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { MenuIcon } from "~/app/_components/icons";
import { NavLink } from "~/app/_components/nav-link";
import { auth } from "~/server/better-auth";
import type { getSession } from "~/server/better-auth/server";

const navItems = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

/**
 * The marketing homepage's own header — not the signed-in app's sidebar
 * (see `sidebar-nav.tsx`). Session-aware: shows a "Sign in" link (to the
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
    <header className="py-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="TrackMyEstate home">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-sm font-bold text-white">
            T
          </span>
          <span className="font-display text-sm font-semibold text-slate-900 dark:text-slate-50">
            TrackMyEstate
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {session ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-slate-500 sm:inline dark:text-slate-400">
                {session.user?.name}
              </span>
              <Button href="/dashboard" pill size="sm">
                Dashboard
              </Button>
              <form>
                <button
                  formAction={async () => {
                    "use server";
                    await auth.api.signOut({ headers: await headers() });
                    redirect("/");
                  }}
                  className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <div className="hidden items-center gap-3 sm:flex">
              <NavLink href="/login">Sign in</NavLink>
              <Button href="/login" pill size="sm">
                Get started
              </Button>
            </div>
          )}

          <details className="relative md:hidden">
            <summary
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 [&::-webkit-details-marker]:hidden"
              aria-label="Toggle navigation"
            >
              <MenuIcon className="h-5 w-5" />
            </summary>
            <div className="absolute right-0 top-full z-50 mt-3 w-48 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900">
              <nav className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <NavLink key={item.href} href={item.href}>
                    {item.label}
                  </NavLink>
                ))}
                {!session && (
                  <>
                    <hr className="my-2 border-slate-200 dark:border-slate-800" />
                    <NavLink href="/login">Sign in</NavLink>
                  </>
                )}
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
