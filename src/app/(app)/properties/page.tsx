import { Suspense } from "react";
import { ListSkeleton, StatRowSkeleton } from "~/app/_components/skeleton";
import clsx from "clsx";
import Link from "next/link";
import { Button } from "~/app/_components/button";
import { EmptyState } from "~/app/_components/empty-state";
import { PlusIcon, PropertiesIcon } from "~/app/_components/icons";
import { PageHeader } from "~/app/_components/page-header";
import type { Currency } from "../../../../generated/prisma";
import { daysUntil, formatMoney, formatShortDate } from "~/lib/format";
import {
  formatTotals,
  hasNegative,
  isZeroTotal,
  sumByCurrency,
} from "~/lib/money-totals";
import { PROPERTY_CATEGORY_LABELS, PROPERTY_TYPE_LABELS } from "~/lib/labels";
import { requireScope } from "~/server/households";
import { getUserCurrency, getUserTimeZone } from "~/server/queries/settings";
import { getProperties } from "~/server/queries/properties";

type PropertyType = keyof typeof PROPERTY_TYPE_LABELS;

/** Card header tint per property type. */
const TYPE_TINT: Record<string, string> = {
  RENTED: "bg-accent-soft text-accent",
  SELF_OCCUPIED: "bg-sunken-2 text-ink-2",
  UNDER_CONSTRUCTION: "bg-warn-soft text-warn",
  INVESTMENT: "bg-accent-soft text-accent-strong",
};

function isPropertyType(value: string | undefined): value is PropertyType {
  return value !== undefined && value in PROPERTY_TYPE_LABELS;
}

async function PropertiesContent({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const scope = await requireScope();

  const [properties, timeZone, currency, { type }] = await Promise.all([
    getProperties(scope.householdId),
    getUserTimeZone(scope.userId),
    getUserCurrency(scope.userId),
    searchParams,
  ]);
  const isPast = (date: Date) => daysUntil(date, new Date(), timeZone) < 0;
  const activeType = isPropertyType(type) ? type : undefined;
  const shown = activeType
    ? properties.filter((property) => property.type === activeType)
    : properties;

  // Totals per currency: a property's figures are in its own currency.
  const totalValue = sumByCurrency(
    properties.map((p) => ({
      amount: p.currentEstimatedValue,
      currency: p.currency,
    })),
    currency,
  );
  const totalGain = sumByCurrency(
    properties.map((p) => ({
      amount:
        p.currentEstimatedValue != null && p.purchasePrice != null
          ? p.currentEstimatedValue - p.purchasePrice
          : null,
      currency: p.currency,
    })),
    currency,
  );
  const monthlyRent = sumByCurrency(
    properties.flatMap((p) =>
      p.leases.map((lease) => ({
        amount: lease.rentAmount,
        currency: lease.currency ?? p.currency,
      })),
    ),
    currency,
  );
  const overdueTotal = sumByCurrency(
    properties.flatMap((p) =>
      p.openBills
        .filter((bill) => isPast(bill.dueDate))
        .map((bill) => ({
          amount: bill.amount,
          currency: bill.currency ?? p.currency,
        })),
    ),
    currency,
  );

  const tabs = [
    {
      label: "All",
      href: "/properties",
      count: properties.length,
      active: !activeType,
    },
    ...(Object.keys(PROPERTY_TYPE_LABELS) as PropertyType[]).map((key) => ({
      label: PROPERTY_TYPE_LABELS[key],
      href: `/properties?type=${key}`,
      count: properties.filter((p) => p.type === key).length,
      active: activeType === key,
    })),
  ];

  return (
    <>
      {properties.length === 0 ? (
        <EmptyState
          Icon={PropertiesIcon}
          title="No properties yet"
          description="Add a property to start tracking rent, utility bills, occupancy and the loan or insurance linked to it."
          actionLabel="Add your first property"
          actionHref="/properties/new"
        />
      ) : (
        <>
          <section
            aria-label="Totals"
            className="grid grid-cols-2 divide-line-soft overflow-hidden rounded-card border border-line bg-surface lg:grid-cols-4 lg:divide-x"
          >
            <Total
              label="Total value"
              value={formatTotals(totalValue, currency)}
            />
            <Total
              label="Gain since purchase"
              value={formatTotals(totalGain, currency, { signed: true })}
              valueClassName={
                hasNegative(totalGain) ? "text-danger" : "text-accent"
              }
            />
            <Total
              label="Monthly rent"
              value={formatTotals(monthlyRent, currency)}
            />
            <Total
              label="Overdue"
              value={formatTotals(overdueTotal, currency)}
              valueClassName={
                isZeroTotal(overdueTotal) ? undefined : "text-danger"
              }
            />
          </section>

          <nav
            aria-label="Filter by type"
            className="flex flex-wrap gap-1 self-start rounded-xl bg-sunken-2 p-1"
          >
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={tab.active ? "page" : undefined}
                className={clsx(
                  "inline-flex h-9 items-center rounded-[9px] px-3.5 text-[0.8125rem] transition-colors",
                  tab.active
                    ? "bg-surface font-semibold text-ink shadow-sm"
                    : "font-medium text-ink-2 hover:text-ink",
                )}
              >
                {tab.label} · {tab.count}
              </Link>
            ))}
          </nav>

          <section
            aria-label="Your properties"
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {shown.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                timeZone={timeZone}
                currency={currency}
              />
            ))}
            <Link
              href="/properties/new"
              className="flex min-h-72 flex-col items-center justify-center gap-2.5 rounded-card border-[1.5px] border-dashed border-line-strong p-6 text-center transition-colors hover:border-accent hover:bg-surface"
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
                <PlusIcon className="size-5" />
              </span>
              <span className="text-[0.9375rem] font-semibold text-ink">
                Add a property
              </span>
              <span className="max-w-60 text-[0.8125rem] leading-relaxed text-muted">
                Start with a name and address — fill in the rest later.
              </span>
            </Link>
          </section>
        </>
      )}
    </>
  );
}

function Total({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="space-y-1 border-line-soft px-5 py-4 odd:border-r max-lg:nth-[-n+2]:border-b sm:px-6 lg:border-0">
      <p className="text-[0.8125rem] text-muted">{label}</p>
      <p
        className={clsx(
          "font-display text-2xl font-semibold text-ink",
          valueClassName,
        )}
      >
        {value}
      </p>
    </div>
  );
}

function PropertyCard({
  property,
  timeZone,
  currency: userCurrency,
}: {
  property: Awaited<ReturnType<typeof getProperties>>[number];
  timeZone: string;
  currency: Currency;
}) {
  const currency = property.currency ?? userCurrency;
  const lease = property.leases[0];
  const overdue = property.openBills.filter(
    (bill) => daysUntil(bill.dueDate, new Date(), timeZone) < 0,
  );
  const nextBill = property.openBills.find(
    (bill) => daysUntil(bill.dueDate, new Date(), timeZone) >= 0,
  );
  const openTotal = sumByCurrency(property.openBills, currency);
  const gainPercent =
    property.currentEstimatedValue != null && property.purchasePrice
      ? ((property.currentEstimatedValue - property.purchasePrice) /
          property.purchasePrice) *
        100
      : null;
  const href = `/properties/${property.id}`;

  return (
    <article className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
      <div
        className={clsx(
          "relative flex h-24 items-end px-5 pb-4",
          TYPE_TINT[property.type] ?? TYPE_TINT.SELF_OCCUPIED,
        )}
      >
        <PropertiesIcon className="size-10" strokeWidth={1.5} />
        <span className="absolute top-3.5 right-3.5 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-ink-2">
          {PROPERTY_TYPE_LABELS[property.type]}
        </span>
        {overdue.length > 0 && (
          <span className="absolute top-3.5 left-3.5 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger">
            {overdue.length} overdue
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3.5 p-5">
        <div className="space-y-0.5">
          <h2 className="text-[1.0625rem] font-semibold text-ink">
            <Link href={href} className="hover:text-accent">
              {property.name}
            </Link>
          </h2>
          <p className="text-[0.8125rem] text-muted">
            {property.city}, {property.state}
            {property.propertyCategory &&
              ` · ${PROPERTY_CATEGORY_LABELS[property.propertyCategory]}`}
          </p>
        </div>

        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-2xl font-semibold text-ink">
            {property.currentEstimatedValue != null
              ? formatMoney(property.currentEstimatedValue, currency)
              : "—"}
          </span>
          {gainPercent != null && (
            <span
              className={clsx(
                "text-[0.8125rem] font-semibold",
                gainPercent >= 0 ? "text-accent" : "text-danger",
              )}
            >
              {gainPercent >= 0 ? "+" : ""}
              {gainPercent.toFixed(1)}%
            </span>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[0.8125rem]">
          <div>
            <dt className="text-muted">Tenant</dt>
            <dd className="mt-0.5 truncate font-medium text-ink">
              {lease?.tenantName ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Rent</dt>
            <dd className="mt-0.5 font-medium text-ink">
              {lease
                ? `${formatMoney(lease.rentAmount, lease.currency ?? currency)} / month`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Next due</dt>
            <dd className="mt-0.5 font-medium text-ink">
              {nextBill ? formatShortDate(nextBill.dueDate) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Open bills</dt>
            <dd
              className={clsx(
                "mt-0.5 font-medium",
                overdue.length > 0 ? "text-danger" : "text-ink",
              )}
            >
              {isZeroTotal(openTotal)
                ? "None"
                : formatTotals(openTotal, currency)}
            </dd>
          </div>
        </dl>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line-soft pt-3.5">
          <Link
            href={href}
            className="text-sm font-semibold text-accent hover:text-accent-strong"
          >
            View details →
          </Link>
          <div className="flex gap-1.5">
            <Button
              href={`/properties/${property.id}/utilities`}
              variant="outline"
              size="sm"
            >
              Bills
            </Button>
            <Button
              href={`/properties/${property.id}/leases`}
              variant="outline"
              size="sm"
            >
              Leases
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * The header is the same for everyone, so it is prerendered and shows the
 * moment the page is opened; the data streams in beneath it.
 */
export default function PropertiesPage(
  props: Parameters<typeof PropertiesContent>[0],
) {
  return (
    <>
      <PageHeader
        title="Properties"
        description="Every home, rental and investment property — with its rent, bills, tenants and paper trail."
        action={
          <Button href="/properties/new">
            <PlusIcon />
            Add property
          </Button>
        }
      />

      <Suspense
        fallback={
          <>
            <StatRowSkeleton />
            <ListSkeleton />
          </>
        }
      >
        <PropertiesContent {...props} />
      </Suspense>
    </>
  );
}
