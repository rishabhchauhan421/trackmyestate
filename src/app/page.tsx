import { type Metadata } from "next";
import Link from "next/link";

import { Button } from "~/app/_components/button";
import {
  BellIcon,
  CheckIcon,
  DocumentsIcon,
  InsuranceIcon,
  InvestmentsIcon,
  LoansIcon,
  PlusIcon,
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

/** Example rows for the hero's "this week" card — illustrative only. */
const heroRows = [
  {
    when: "Overdue",
    what: "Electricity bill",
    amount: "₹4,120",
    tone: "danger",
  },
  { when: "Today", what: "Home loan EMI", amount: "₹71,250", tone: "warn" },
  { when: "7 Oct", what: "Rent received", amount: "+₹32,000", tone: "in" },
  {
    when: "10 Oct",
    what: "Society maintenance",
    amount: "₹3,500",
    tone: "plain",
  },
] as const;

const HERO_TONES = {
  danger: "bg-danger-soft [&>span:first-child]:text-danger",
  warn: "bg-warn-soft [&>span:first-child]:text-warn",
  in: "bg-sunken [&>span:first-child]:text-muted [&>span:last-child]:text-accent",
  plain: "bg-sunken [&>span:first-child]:text-muted",
};

const sectionEyebrow =
  "text-[0.8125rem] font-semibold tracking-[0.08em] uppercase";
const sectionTitle =
  "font-display text-4xl leading-tight font-semibold tracking-[-0.02em] text-balance";

export default async function Home() {
  const session = await getSession();

  return (
    <div className="bg-ground text-ink">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <SiteHeader session={session} />

      <main>
        <section className="mx-auto flex max-w-300 flex-col items-center gap-14 px-4 pt-10 pb-20 sm:px-8 lg:flex-row lg:pt-16 lg:pb-24">
          <div className="flex-1 space-y-6">
            <span className="inline-flex rounded-full bg-accent-soft px-3 py-1.5 text-[0.8125rem] font-semibold text-accent-strong">
              Free for properties, policies, loans &amp; investments
            </span>
            <h1 className="font-display text-5xl leading-[1.02] font-bold tracking-[-0.035em] text-balance sm:text-6xl">
              Aggregate everything.{" "}
              <span className="text-accent">Never miss a date.</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-ink-2">
              Every property, insurance policy, investment and loan in one place
              — with reminders for premiums, EMIs, rent and maturities before
              they slip.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button href="/login" size="lg">
                Start tracking — it&apos;s free →
              </Button>
              <Button href="#features" variant="outline" size="lg">
                See how it works
              </Button>
            </div>
            <p className="text-[0.8125rem] text-muted">
              No card required. Your documents are encrypted and never shared.
            </p>
          </div>

          <div aria-hidden="true" className="relative w-full max-w-lg flex-1">
            <div className="absolute inset-y-6 right-0 left-10 rounded-3xl bg-night" />
            <div className="relative mr-12 space-y-3 rounded-[20px] bg-surface p-5 shadow-[0_24px_60px_rgb(16_32_28/0.18)]">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold">This week</span>
                <span className="text-xs text-muted">Next 7 days</span>
              </div>
              {heroRows.map((row) => (
                <div
                  key={row.what}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 ${HERO_TONES[row.tone]}`}
                >
                  <span className="w-16 text-[0.6875rem] font-bold uppercase">
                    {row.when}
                  </span>
                  <span className="flex-1 text-sm font-medium">{row.what}</span>
                  <span className="text-sm font-semibold">{row.amount}</span>
                </div>
              ))}
            </div>
            <div className="relative -mt-6 ml-auto flex w-64 items-start gap-3 rounded-card bg-surface p-4 shadow-[0_18px_40px_rgb(16_32_28/0.2)]">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
                <BellIcon className="size-4.5" />
              </span>
              <span className="space-y-0.5">
                <span className="block text-[0.8125rem] font-semibold">
                  Premium due in 14 days
                </span>
                <span className="block text-xs leading-snug text-muted">
                  Pay before the due date to stay covered.
                </span>
              </span>
            </div>
          </div>
        </section>

        <section
          id="features"
          aria-labelledby="features-title"
          className="border-y border-line bg-surface"
        >
          <div className="mx-auto max-w-300 space-y-12 px-4 py-20 sm:px-8 lg:py-24">
            <div className="max-w-2xl space-y-3">
              <p className={`${sectionEyebrow} text-accent`}>
                How TrackMyEstate helps
              </p>
              <h2 id="features-title" className={sectionTitle}>
                Three things, done really well.
              </h2>
            </div>
            <ol className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {pillars.map((pillar, index) => {
                const featured = index === pillars.length - 1;
                return (
                  <li
                    key={pillar.title}
                    className={`space-y-3.5 rounded-[20px] p-7 ${featured ? "bg-night text-white" : "bg-sunken"}`}
                  >
                    <span
                      className={`font-display text-[0.9375rem] font-bold ${featured ? "text-mint" : "text-accent"}`}
                    >
                      0{index + 1}
                    </span>
                    <h3 className="text-xl font-semibold">{pillar.title}</h3>
                    <p
                      className={`text-[0.9375rem] leading-relaxed ${featured ? "text-night-ink" : "text-ink-2"}`}
                    >
                      {pillar.description}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section
          aria-labelledby="modules-title"
          className="mx-auto max-w-300 space-y-10 px-4 py-20 sm:px-8 lg:py-24"
        >
          <div className="max-w-2xl space-y-3">
            <p className={`${sectionEyebrow} text-accent`}>
              Everything you can track
            </p>
            <h2 id="modules-title" className={sectionTitle}>
              Your whole financial life, in one place.
            </h2>
          </div>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {modules.map(({ label, description, Icon }) => (
              <li
                key={label}
                className="space-y-2.5 rounded-card border border-line bg-surface p-5"
              >
                <Icon className="size-7 text-accent" strokeWidth={1.6} />
                <h3 className="text-[1.0625rem] font-semibold">{label}</h3>
                <p className="text-sm leading-relaxed text-ink-2">
                  {description}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section
          id="pricing"
          aria-labelledby="pricing-title"
          className="bg-night text-white"
        >
          <div className="mx-auto max-w-300 space-y-10 px-4 py-20 sm:px-8 lg:py-24">
            <div className="max-w-2xl space-y-3">
              <p className={`${sectionEyebrow} text-mint`}>Pricing</p>
              <h2 id="pricing-title" className={sectionTitle}>
                Simple pricing, free to start.
              </h2>
            </div>
            <div className="grid max-w-4xl grid-cols-1 gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-5 rounded-[20px] border border-night-3 p-7">
                <div className="space-y-1.5">
                  <h3 className="text-lg font-semibold">Free</h3>
                  <p className="font-display text-4xl font-bold">₹0</p>
                </div>
                <PlanFeatures
                  features={planFeatures}
                  className="text-night-ink"
                  checkClassName="text-mint"
                />
                <Link
                  href="/login"
                  className="mt-auto inline-flex h-12 items-center justify-center rounded-control border border-mint text-[0.9375rem] font-semibold text-mint transition-colors hover:bg-mint hover:text-night"
                >
                  Get started for free
                </Link>
              </div>
              <div className="flex flex-col gap-5 rounded-[20px] bg-surface p-7 text-ink">
                <div className="space-y-1.5">
                  <h3 className="text-lg font-semibold">Pro</h3>
                  <p className="font-display text-4xl font-bold">
                    $20
                    <span className="font-sans text-base font-normal text-muted">
                      /month
                    </span>
                  </p>
                  <p className="text-sm text-muted">
                    For power users who want priority support and early access.
                  </p>
                </div>
                <PlanFeatures
                  features={proPlanFeatures}
                  className="text-ink-2"
                  checkClassName="text-accent"
                />
                <Button href="/login" size="lg" className="mt-auto">
                  Upgrade to Pro
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section
          id="faq"
          aria-labelledby="faq-title"
          className="mx-auto flex max-w-300 flex-col gap-12 px-4 py-20 sm:px-8 lg:flex-row lg:py-24"
        >
          <div className="space-y-3 lg:w-80">
            <p className={`${sectionEyebrow} text-accent`}>FAQ</p>
            <h2 id="faq-title" className={sectionTitle}>
              Questions, answered.
            </h2>
          </div>
          <div className="flex-1 divide-y divide-line border-y border-line">
            {faqs.map((faq, index) => (
              <details
                key={faq.question}
                open={index === 0}
                className="group py-5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[1.0625rem] font-semibold [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <PlusIcon className="size-5 shrink-0 text-muted transition-transform group-open:rotate-45" />
                </summary>
                <p className="mt-2.5 text-[0.9375rem] leading-relaxed text-ink-2">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-300 px-4 pb-20 sm:px-8 lg:pb-24">
          <div className="flex flex-col gap-6 rounded-[28px] bg-accent px-8 py-12 text-white sm:px-12 lg:flex-row lg:items-center lg:justify-between dark:text-night">
            <div className="max-w-xl space-y-2.5">
              <h2 className="font-display text-[2.25rem] leading-tight font-semibold tracking-[-0.02em]">
                Get your first five assets in tonight.
              </h2>
              <p className="text-base opacity-85">
                Start with names and dates. Your timeline fills in as you go.
              </p>
            </div>
            <Button href="/login" color="white" size="lg">
              Start tracking — it&apos;s free →
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function PlanFeatures({
  features,
  className,
  checkClassName,
}: {
  features: string[];
  className: string;
  checkClassName: string;
}) {
  return (
    <ul className={`space-y-2.5 text-[0.9375rem] ${className}`}>
      {features.map((feature) => (
        <li key={feature} className="flex gap-2.5">
          <CheckIcon className={`size-5 flex-none ${checkClassName}`} />
          {feature}
        </li>
      ))}
    </ul>
  );
}
