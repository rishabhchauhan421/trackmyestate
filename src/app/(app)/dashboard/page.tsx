import clsx from "clsx";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { Card, CardHeader, StatCard } from "~/app/_components/card";
import {
  CheckIcon,
  InflowIcon,
  OutflowIcon,
  PlusIcon,
  UploadIcon,
} from "~/app/_components/icons";
import { PageHeader } from "~/app/_components/page-header";
import {
  daysUntil,
  formatDueIn,
  formatINR,
  formatShortDate,
} from "~/lib/format";
import { getSession } from "~/server/better-auth/server";
import { getDashboardData } from "~/server/queries/dashboard";

const CATEGORY_LABELS: Record<string, string> = {
  RENT: "Rent",
  UTILITY_BILL: "Bill",
  PREMIUM: "Premium",
  PAYOUT: "Payout",
  EMI: "EMI",
  INVESTMENT_RETURN: "Return",
  CLAIM_SETTLEMENT: "Claim settlement",
  CUSTOM: "Custom",
};

type Tone = "danger" | "warn" | "in" | "plain";

const TONE_STYLES: Record<Tone, { chip: string; icon: string }> = {
  danger: {
    chip: "bg-danger-soft text-danger",
    icon: "bg-danger-soft text-danger",
  },
  warn: { chip: "bg-warn-soft text-warn", icon: "bg-warn-soft text-warn" },
  in: {
    chip: "bg-accent-soft text-accent-strong",
    icon: "bg-accent-soft text-accent",
  },
  plain: { chip: "bg-sunken-2 text-ink-2", icon: "bg-sunken-2 text-ink-2" },
};

function toneFor(bill: { status: string; direction: string; dueDate: Date }) {
  if (bill.status === "OVERDUE" || daysUntil(bill.dueDate) < 0) return "danger";
  if (bill.direction === "INFLOW") return "in";
  if (daysUntil(bill.dueDate) <= 7) return "warn";
  return "plain";
}

function signedAmount(bill: { direction: string; amount: number }) {
  return bill.direction === "INFLOW"
    ? `+${formatINR(bill.amount)}`
    : formatINR(bill.amount);
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const {
    netWorth,
    propertyValue,
    investmentValue,
    loanOutstanding,
    totalCoverage,
    upcomingOutflows,
    expectedInflows,
    attentionItems,
    upcoming,
  } = await getDashboardData(session.user.id);

  const firstName = session.user.name?.split(" ")[0];
  const overdueCount = attentionItems.filter(
    (item) => toneFor(item) === "danger",
  ).length;
  const dueSoonCount = attentionItems.length - overdueCount;
  const summary =
    attentionItems.length === 0
      ? "Nothing overdue or due in the next 7 days."
      : [
          overdueCount > 0 && `${plural(overdueCount, "bill")} overdue`,
          dueSoonCount > 0 &&
            `${plural(dueSoonCount, "payment")} due this week`,
        ]
          .filter(Boolean)
          .join(" and ") + ".";

  const assets = propertyValue + investmentValue;
  const flowMax = Math.max(upcomingOutflows, expectedInflows, 1);

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Dashboard"}
        description={summary}
        action={
          <>
            <Button href="/documents" variant="outline">
              <UploadIcon />
              Upload a document
            </Button>
            <Button href="/properties/new">
              <PlusIcon />
              Add asset
            </Button>
          </>
        }
      />

      <section
        aria-label="Summary"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          tone="dark"
          label="Net worth"
          value={formatINR(netWorth)}
          hint={`${formatINR(assets)} assets − ${formatINR(loanOutstanding)} loans`}
        />
        <StatCard
          label="Insurance cover"
          value={formatINR(totalCoverage)}
          hint="Across active policies"
        />
        <StatCard
          label="Going out · next 30 days"
          value={formatINR(upcomingOutflows)}
          hint="EMIs, premiums & bills"
        />
        <StatCard
          label="Coming in · next 30 days"
          value={formatINR(expectedInflows)}
          hint="Rent, payouts & returns"
          valueClassName="text-accent"
        />
      </section>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <Card aria-labelledby="attention" className="lg:col-span-2">
          <CardHeader
            title={<span id="attention">Needs attention</span>}
            action={
              <Link href="/timeline" className="hover:text-accent-strong">
                Open timeline →
              </Link>
            }
          />
          {attentionItems.length === 0 ? (
            <div className="flex items-center gap-3 px-6 py-8 text-sm text-muted">
              <CheckIcon className="size-5 text-ok" />
              You&apos;re all caught up — nothing overdue or due in the next 7
              days.
            </div>
          ) : (
            <ul className="divide-y divide-line-soft">
              {attentionItems.map((item) => {
                const tone = TONE_STYLES[toneFor(item)];
                const Icon =
                  item.direction === "INFLOW" ? InflowIcon : OutflowIcon;
                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 sm:px-6"
                  >
                    <span
                      className={clsx(
                        "flex size-10 shrink-0 items-center justify-center rounded-control",
                        tone.icon,
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1 basis-52">
                      <p className="truncate text-sm font-medium text-ink">
                        {item.description ?? CATEGORY_LABELS[item.category]}
                      </p>
                      <p className="text-[0.8125rem] text-muted">
                        Due {formatShortDate(item.dueDate)}
                      </p>
                    </div>
                    <span
                      className={clsx(
                        "rounded-full px-2.5 py-1 text-xs font-semibold",
                        tone.chip,
                      )}
                    >
                      {formatDueIn(item.dueDate)}
                    </span>
                    <span
                      className={clsx(
                        "w-24 text-right text-[0.9375rem] font-semibold",
                        item.direction === "INFLOW"
                          ? "text-accent"
                          : "text-ink",
                      )}
                    >
                      {signedAmount(item)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card aria-labelledby="cashflow" className="space-y-4 p-5 sm:p-6">
            <h2 id="cashflow" className="text-base font-semibold text-ink">
              Next 30 days
            </h2>
            <FlowBar
              label="Coming in"
              amount={expectedInflows}
              max={flowMax}
              barClassName="bg-accent"
              amountClassName="text-accent"
            />
            <FlowBar
              label="Going out"
              amount={upcomingOutflows}
              max={flowMax}
              barClassName="bg-ink"
            />
            <p className="text-[0.8125rem] text-muted">
              Net{" "}
              <strong className="font-semibold text-ink">
                {expectedInflows - upcomingOutflows < 0 ? "−" : "+"}
                {formatINR(Math.abs(expectedInflows - upcomingOutflows))}
              </strong>{" "}
              over the next month.
            </p>
          </Card>

          <Card aria-labelledby="mix" className="space-y-3.5 p-5 sm:p-6">
            <h2 id="mix" className="text-base font-semibold text-ink">
              Portfolio
            </h2>
            {assets > 0 && (
              <div className="flex h-3 gap-0.5 overflow-hidden rounded-full">
                <div
                  className="bg-accent"
                  style={{ flexGrow: propertyValue }}
                />
                <div
                  className="bg-mint"
                  style={{ flexGrow: investmentValue }}
                />
              </div>
            )}
            <dl className="space-y-2.5 text-[0.8125rem]">
              <MixRow
                label="Properties"
                value={formatINR(propertyValue)}
                swatch="bg-accent"
              />
              <MixRow
                label="Investments"
                value={formatINR(investmentValue)}
                swatch="bg-mint"
              />
              <MixRow
                label="Loans"
                value={`−${formatINR(loanOutstanding)}`}
                swatch="border-2 border-ink"
              />
            </dl>
          </Card>
        </div>
      </div>

      {upcoming.length > 0 && (
        <Card aria-labelledby="upcoming" className="space-y-4 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id="upcoming" className="text-base font-semibold text-ink">
              Coming up
            </h2>
            <Link
              href="/timeline"
              className="text-[0.8125rem] font-medium text-accent hover:text-accent-strong"
            >
              Full timeline →
            </Link>
          </div>
          <ol className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {upcoming.map((bill) => {
              const days = daysUntil(bill.dueDate);
              return (
                <li
                  key={bill.id}
                  className="flex flex-col gap-2 rounded-xl border border-line-soft p-3.5"
                >
                  <span
                    className={clsx(
                      "text-xs font-semibold uppercase",
                      days === 0 ? "text-warn" : "text-muted",
                    )}
                  >
                    {formatShortDate(bill.dueDate)}
                    {days === 0 && " · Today"}
                  </span>
                  <span className="line-clamp-2 text-sm font-medium text-ink">
                    {bill.description ?? CATEGORY_LABELS[bill.category]}
                  </span>
                  <span
                    className={clsx(
                      "mt-auto text-sm font-semibold",
                      bill.direction === "INFLOW" ? "text-accent" : "text-ink",
                    )}
                  >
                    {signedAmount(bill)}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </>
  );
}

function FlowBar({
  label,
  amount,
  max,
  barClassName,
  amountClassName,
}: {
  label: string;
  amount: number;
  max: number;
  barClassName: string;
  amountClassName?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[0.8125rem]">
        <span className="text-muted">{label}</span>
        <span className={clsx("font-semibold text-ink", amountClassName)}>
          {formatINR(amount)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-sunken-2">
        <div
          className={clsx("h-full rounded-full", barClassName)}
          style={{ width: `${Math.round((amount / max) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function MixRow({
  label,
  value,
  swatch,
}: {
  label: string;
  value: string;
  swatch: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={clsx("size-2.5 rounded-[3px]", swatch)} />
      <dt className="flex-1 text-ink-2">{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}
