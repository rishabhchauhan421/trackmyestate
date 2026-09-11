import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  DocumentsIcon,
  InsuranceIcon,
  InvestmentsIcon,
  PropertiesIcon,
  TimelineIcon,
} from "~/app/_components/icons";
import { auth } from "~/server/better-auth";
import { getSession } from "~/server/better-auth/server";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components

const pillars = [
  {
    title: "Fast onboarding",
    description:
      "Drop in a policy PDF, loan statement or property paper and we pre-fill the record. Or start with a bare name and one date, and enrich it later.",
  },
  {
    title: "A smart reminder engine",
    description:
      "The right nudge, early enough, on the right channel — push, email or WhatsApp — with escalation as a deadline nears.",
  },
  {
    title: "One unified timeline",
    description:
      "Every rupee going out and coming in, dated: rent, premiums, EMIs, bills, maturities and returns, in a single screen.",
  },
];

const modules = [
  {
    label: "Properties",
    description: "Homes, rentals and investment property, with tenants, rent and bills.",
    Icon: PropertiesIcon,
  },
  {
    label: "Insurance",
    description: "Life, health, vehicle and home policies — premiums, cover and maturity.",
    Icon: InsuranceIcon,
  },
  {
    label: "Investments & loans",
    description: "FDs, mutual funds, stocks and gold, alongside EMIs and amortization.",
    Icon: InvestmentsIcon,
  },
  {
    label: "Documents",
    description: "Every paper trail, encrypted and attached to the asset it belongs to.",
    Icon: DocumentsIcon,
  },
];

export default async function Home() {
  const session = await getSession();

  return (
    <main className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-sm font-bold text-white">
            T
          </span>
          <span className="text-sm font-semibold">TrackMyEstate</span>
        </div>

        {session ? (
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline dark:text-slate-400">
              {session.user?.name}
            </span>
            <Link
              href="/dashboard"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              Go to dashboard
            </Link>
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
          <form>
            <button
              formAction={async () => {
                "use server";
                const res = await auth.api.signInSocial({
                  body: { provider: "google", callbackURL: "/dashboard" },
                });
                if (!res.url) {
                  throw new Error("No URL returned from signInSocial");
                }
                redirect(res.url);
              }}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              Sign in with Google
            </button>
          </form>
        )}
      </header>

      <section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 py-20 text-center sm:py-28">
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          For people with a lot going on
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Aggregate everything. Never miss a date.
        </h1>
        <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-400">
          Properties, insurance, investments and loans — every premium,
          renewal, EMI, rent collection and maturity, in one place, with a
          reminder that actually reaches you in time.
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            Get started
          </Link>
          <Link
            href="/timeline"
            className="rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            See the timeline
          </Link>
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50 dark:border-slate-900 dark:bg-slate-900/40">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-16 sm:grid-cols-3">
          {pillars.map((pillar) => (
            <div key={pillar.title}>
              <h3 className="text-base font-semibold">{pillar.title}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {pillar.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10 max-w-xl">
          <h2 className="text-2xl font-semibold tracking-tight">
            Everything you own, one shared spine
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Every asset reduces to dated money in, money out, and the dates
            that matter. Build that once, and it powers the timeline, the
            dashboard and every reminder.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map(({ label, description, Icon }) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 text-sm font-semibold">{label}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-100 px-6 py-8 text-center text-xs text-slate-400 dark:border-slate-900">
        TrackMyEstate — your whole financial life, tracked, dated and
        reminded.
      </footer>
    </main>
  );
}
