import { type Metadata } from "next";
import Image from "next/image";

import { Button } from "~/app/_components/button";
import {
  CheckIcon,
  DocumentsIcon,
  InsuranceIcon,
  InvestmentsIcon,
  LoansIcon,
  PropertiesIcon,
} from "~/app/_components/icons";
import { SiteFooter } from "~/app/_components/site-footer";
import { SiteHeader } from "~/app/_components/site-header";
import { env } from "~/env";
import { getSession } from "~/server/better-auth/server";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components

const title =
  "TrackMyEstate — Free Property, Policy, Loan and Investment Tracker";
const description =
  "Aggregate every property, insurance policy, investment and loan in one place, free. Get reminders for premiums, EMIs, rent and maturities before you miss a date.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "TrackMyEstate",
    locale: "en_US",
    title,
    description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "TrackMyEstate",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description,
  url: env.NEXT_PUBLIC_SITE_URL,
  isAccessibleForFree: true,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "INR",
  },
};

const faqs = [
  {
    question: "Is TrackMyEstate free to use?",
    answer:
      "Yes. Every core feature — properties, insurance, investments, loans, documents and reminders — is free to use, with no card required to get started.",
  },
  {
    question: "What can I track with TrackMyEstate?",
    answer:
      "Properties and leases, insurance policies, investments like FDs, mutual funds, stocks and gold, loan EMIs and amortization, and every document tied to them.",
  },
  {
    question: "How do the reminders work?",
    answer:
      "You get a nudge on push, email or WhatsApp ahead of a premium, EMI, rent collection or maturity date, with escalation as the deadline nears.",
  },
  {
    question: "Is my financial data secure?",
    answer:
      "Every document is encrypted and only visible to your account. We never sell or share your data with third parties.",
  },
  {
    question: "Do I have to enter everything manually?",
    answer:
      "No. Drop in a policy PDF, loan statement or property paper and we pre-fill the record, or start with just a name and a date and enrich it later.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: {
      "@type": "Answer",
      text: answer,
    },
  })),
};

/** Splits `faqs` round-robin into `columns` roughly-even columns, for the FAQ grid below. */
function intoColumns<T>(items: T[], columns: number): T[][] {
  const result: T[][] = Array.from({ length: columns }, () => []);
  items.forEach((item, i) => result[i % columns]!.push(item));
  return result;
}

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
    description:
      "Homes, rentals and investment property, with leases, rent and bills.",
    Icon: PropertiesIcon,
  },
  {
    label: "Insurance",
    description:
      "Life, health, vehicle and home policies — premiums, cover and maturity.",
    Icon: InsuranceIcon,
  },
  {
    label: "Investments",
    description:
      "FDs, mutual funds, stocks and gold — capital deployed and current value.",
    Icon: InvestmentsIcon,
  },
  {
    label: "Loans",
    description:
      "EMIs and amortization, with outstanding balance kept current.",
    Icon: LoansIcon,
  },
  {
    label: "Documents",
    description:
      "Every paper trail, encrypted and attached to the asset it belongs to.",
    Icon: DocumentsIcon,
  },
];

const planFeatures = [
  "Unlimited properties, leases and rental units",
  "Insurance policies, investments and loans",
  "Email reminders",
  "One unified timeline of every cent",
];

const proPlanFeatures = [
  "Everything in Free",
  "WhatsApp reminders",
  "Send reminders to guests",
  "Priority support",
  "Pay bills directly from our portal",
];

export default async function Home() {
  const session = await getSession();
  const faqColumns = intoColumns(faqs, 3);

  return (
    <div className="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <SiteHeader session={session} />

      <main>
        <section className="mx-auto max-w-4xl px-6 pt-8 pb-20 text-center sm:pt-16 sm:pb-28">
          <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
            Free for people with a lot going on
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-medium tracking-tight text-balance sm:text-6xl">
            Aggregate{" "}
            <span className="relative whitespace-nowrap text-blue-600">
              <svg
                aria-hidden="true"
                viewBox="0 0 418 42"
                className="absolute top-2/3 left-0 h-[0.58em] w-full fill-blue-300/70"
                preserveAspectRatio="none"
              >
                <path d="M203.371.916c-26.013-2.078-76.686 1.963-124.73 9.946L67.3 12.749C35.421 18.062 18.2 21.766 6.004 25.934 1.244 27.561.828 27.778.874 28.61c.07 1.214.828 1.121 9.595-1.176 9.072-2.377 17.15-3.92 39.246-7.496C123.565 7.986 157.869 4.492 195.942 5.046c7.461.108 19.25 1.696 19.17 2.582-.107 1.183-7.874 4.31-25.75 10.366-21.992 7.45-35.43 12.534-36.701 13.884-2.173 2.308-.202 4.407 4.442 4.734 2.654.187 3.263.157 15.593-.78 35.401-2.686 57.944-3.488 88.365-3.143 46.327.526 75.721 2.23 130.788 7.584 19.787 1.924 20.814 1.98 24.557 1.332l.066-.011c1.201-.203 1.53-1.825.399-2.335-2.911-1.31-4.893-1.604-22.048-3.261-57.509-5.556-87.871-7.36-132.059-7.842-23.239-.254-33.617-.116-50.627.674-11.629.54-42.371 2.494-46.696 2.967-2.359.259 8.133-3.625 26.504-9.81 23.239-7.825 27.934-10.149 28.304-14.005.417-4.348-3.529-6-16.878-7.066Z" />
              </svg>
              <span className="relative">everything</span>
            </span>
            . Never miss a date.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
            Properties, insurance, investments and loans — every premium,
            renewal, EMI, rent collection and maturity, in one place, with a
            reminder that actually reaches you in time.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Button href="/login" pill size="lg">
              Get started for free
            </Button>
            <Button href="/timeline" pill variant="outline" size="lg">
              See the timeline
            </Button>
          </div>
          <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
            Free to use, forever. No credit card required.
          </p>
        </section>

        <section
          id="features"
          aria-label="How TrackMyEstate helps"
          className="relative overflow-hidden bg-blue-600 py-20 sm:py-28"
        >
          <Image
            className="absolute top-1/2 left-1/2 max-w-none translate-x-[-44%] translate-y-[-42%] opacity-80"
            src="/images/background-features.jpg"
            alt=""
            width={2245}
            height={1636}
          />
          <div className="relative mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl text-white sm:text-4xl">
                How TrackMyEstate helps
              </h2>
              <p className="mt-4 text-lg text-blue-100">
                Every asset reduces to dated money in, money out, and the
                dates that matter. Build that once, and it powers the
                timeline, the dashboard and every reminder.
              </p>
            </div>
            <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {pillars.map((pillar) => (
                <div
                  key={pillar.title}
                  className="rounded-2xl bg-white/10 p-6 ring-1 ring-white/10 ring-inset"
                >
                  <h3 className="font-display text-lg text-white">
                    {pillar.title}
                  </h3>
                  <p className="mt-2 text-sm text-blue-100">
                    {pillar.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          aria-label="Everything you can track"
          className="py-20 sm:py-28"
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl tracking-tight text-slate-900 sm:text-4xl dark:text-slate-50">
                Everything you own, one shared spine
              </h2>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
                Homes, policies, investments and loans — all reduce to the
                same dated money in, money out.
              </p>
            </div>
            <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {modules.map(({ label, description, Icon }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-3 text-sm font-semibold">{label}</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="get-started"
          aria-label="Get started"
          className="relative overflow-hidden bg-blue-600 py-24 sm:py-32"
        >
          <Image
            className="absolute top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 opacity-80"
            src="/images/background-call-to-action.jpg"
            alt=""
            width={2347}
            height={1244}
          />
          <div className="relative mx-auto max-w-lg px-6 text-center">
            <h2 className="font-display text-3xl text-white sm:text-4xl">
              Get started today
            </h2>
            <p className="mt-4 text-lg text-white/90">
              Free to use, forever. Add your first property, policy or loan
              in minutes, and never miss a date again.
            </p>
            <Button
              href="/login"
              pill
              color="white"
              size="lg"
              className="mt-10"
            >
              Get started for free
            </Button>
          </div>
        </section>

        <section
          id="pricing"
          aria-label="Pricing"
          className="bg-slate-900 py-20 sm:py-32"
        >
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center">
              <h2 className="font-display text-3xl tracking-tight text-white sm:text-4xl">
                <span className="relative whitespace-nowrap">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 281 40"
                    preserveAspectRatio="none"
                    className="absolute top-1/2 left-0 h-[1em] w-full -translate-y-1/2 fill-blue-500"
                  >
                    <path d="M240.172 22.994c-8.007 1.246-15.477 2.23-31.26 4.114-18.506 2.21-26.323 2.977-34.487 3.386-2.971.149-3.727.324-6.566 1.523-15.124 6.388-43.775 9.404-69.425 7.31-26.207-2.14-50.986-7.103-78-15.624C10.912 20.7.988 16.143.734 14.657c-.066-.381.043-.344 1.324.456 10.423 6.506 49.649 16.322 77.8 19.468 23.708 2.65 38.249 2.95 55.821 1.156 9.407-.962 24.451-3.773 25.101-4.692.074-.104.053-.155-.058-.135-1.062.195-13.863-.271-18.848-.687-16.681-1.389-28.722-4.345-38.142-9.364-15.294-8.15-7.298-19.232 14.802-20.514 16.095-.934 32.793 1.517 47.423 6.96 13.524 5.033 17.942 12.326 11.463 18.922l-.859.874.697-.006c2.681-.026 15.304-1.302 29.208-2.953 25.845-3.07 35.659-4.519 54.027-7.978 9.863-1.858 11.021-2.048 13.055-2.145a61.901 61.901 0 0 0 4.506-.417c1.891-.259 2.151-.267 1.543-.047-.402.145-2.33.913-4.285 1.707-4.635 1.882-5.202 2.07-8.736 2.903-3.414.805-19.773 3.797-26.404 4.829Zm40.321-9.93c.1-.066.231-.085.29-.041.059.043-.024.096-.183.119-.177.024-.219-.007-.107-.079ZM172.299 26.22c9.364-6.058 5.161-12.039-12.304-17.51-11.656-3.653-23.145-5.47-35.243-5.576-22.552-.198-33.577 7.462-21.321 14.814 12.012 7.205 32.994 10.557 61.531 9.831 4.563-.116 5.372-.288 7.337-1.559Z" />
                  </svg>
                  <span className="relative">Simple pricing,</span>
                </span>{" "}
                for every net worth.
              </h2>
              <p className="mt-4 text-lg text-slate-400">
                No tiers, no seat limits, no card on file — the whole point
                is that you actually keep using it.
              </p>
            </div>

            <div className="mx-auto mt-16 grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-800/60 px-6 py-8 ring-1 ring-slate-700 sm:px-8">
                <h3 className="font-display text-lg text-white">
                  Free, forever
                </h3>
                <p className="mt-2 text-base text-slate-300">
                  Every core feature, no catches.
                </p>
                <p className="mt-6 font-display text-5xl font-light tracking-tight text-white">
                  $0
                </p>
                <ul className="mt-10 flex flex-col gap-y-3 text-sm text-slate-200">
                  {planFeatures.map((feature) => (
                    <li key={feature} className="flex">
                      <CheckIcon className="h-6 w-6 flex-none text-slate-400" />
                      <span className="ml-3">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  href="/login"
                  pill
                  variant="outline"
                  color="slate"
                  className="mt-8 w-full border-slate-600 text-slate-100 hover:bg-slate-700"
                >
                  Get started for free
                </Button>
              </div>

              <div className="rounded-3xl bg-blue-600 px-6 py-8 sm:px-8">
                <h3 className="font-display text-lg text-white">Pro</h3>
                <p className="mt-2 text-base text-white">
                  For power users who want priority support and early access.
                </p>
                <p className="mt-6 font-display text-5xl font-light tracking-tight text-white">
                  $20
                  <span className="text-lg font-normal text-white/80">
                    /month
                  </span>
                </p>
                <ul className="mt-10 flex flex-col gap-y-3 text-sm text-white">
                  {proPlanFeatures.map((feature) => (
                    <li key={feature} className="flex">
                      <CheckIcon className="h-6 w-6 flex-none text-white" />
                      <span className="ml-3">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button href="/login" pill color="white" className="mt-8 w-full">
                  Upgrade to Pro
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section
          id="faq"
          aria-labelledby="faq-title"
          className="relative overflow-hidden bg-slate-50 py-20 sm:py-32 dark:bg-slate-900/40"
        >
          <Image
            className="absolute top-0 left-1/2 max-w-none translate-x-[-30%] -translate-y-1/4 opacity-70 dark:opacity-15"
            src="/images/background-faqs.jpg"
            alt=""
            width={1558}
            height={946}
          />
          <div className="relative mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl lg:mx-0">
              <h2
                id="faq-title"
                className="font-display text-3xl tracking-tight text-slate-900 sm:text-4xl dark:text-slate-50"
              >
                Frequently asked questions
              </h2>
            </div>
            <ul className="mx-auto mt-16 grid max-w-2xl grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-3">
              {faqColumns.map((column, columnIndex) => (
                <li key={columnIndex}>
                  <ul className="flex flex-col gap-y-8">
                    {column.map((faq) => (
                      <li key={faq.question}>
                        <h3 className="font-display text-lg text-slate-900 dark:text-slate-50">
                          {faq.question}
                        </h3>
                        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                          {faq.answer}
                        </p>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <SiteFooter />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </div>
  );
}
