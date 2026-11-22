import { ChevronDownIcon } from "@heroicons/react/16/solid";
import clsx from "clsx";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "~/app/_components/button";
import { Card, CardHeader, StatCard } from "~/app/_components/card";
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownMenu,
} from "~/app/_components/dropdown";
import { PropertiesIcon } from "~/app/_components/icons";
import { Breadcrumbs, propertyCrumbs } from "~/app/_components/page-header";
import { StatusBadge } from "~/app/_components/status-badge";
import { SubmitButton } from "~/app/_components/submit-button";
import { dateOnly } from "~/lib/calendar-day";
import { nextKeyDate } from "~/lib/issues";
import { todayInTimeZone } from "~/lib/time-zone";
import { daysUntil, formatDate, formatDueIn, formatMoney } from "~/lib/format";
import {
  EVENT_CATEGORY_LABELS,
  ISSUE_TYPE_LABELS,
  OWNERSHIP_TYPE_LABELS,
  PROPERTY_CATEGORY_LABELS,
  PROPERTY_TYPE_LABELS,
} from "~/lib/labels";
import { setFreeholdAlerts } from "~/server/actions/issues";
import { requireScope } from "~/server/households";
import { getUserCurrency, getUserTimeZone } from "~/server/queries/settings";
import { getAllBillsForProperty } from "~/server/queries/bills";
import { getIssuesForProperty } from "~/server/queries/issues";
import { getLeasesForProperty } from "~/server/queries/leases";
import { getPropertyForHousehold } from "~/server/queries/properties";
import { OPEN_PAYMENT_STATUSES } from "~/server/queries/shared";

const OPEN_STATUSES: readonly string[] = OPEN_PAYMENT_STATUSES;

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scope = await requireScope();

  const property = await getPropertyForHousehold(id, scope.householdId);
  if (!property) {
    notFound();
  }

  const [bills, leases, issues, timeZone, userCurrency] = await Promise.all([
    getAllBillsForProperty(id),
    getLeasesForProperty(id),
    getIssuesForProperty(id),
    getUserTimeZone(scope.userId),
    getUserCurrency(scope.userId),
  ]);
  // A property's rent, deposits and bills are in its own currency.
  const currency = property.currency ?? userCurrency;
  const money = (amount: number) => formatMoney(amount, currency);

  const openIssues = issues.filter((issue) => issue.status === "OPEN");
  const closedIssues = issues.length - openIssues.length;
  const today = dateOnly(todayInTimeZone(timeZone));

  const activeLeases = leases.filter((lease) => lease.active);
  const monthlyRent = activeLeases.reduce((s, l) => s + l.rentAmount, 0);
  const openBills = bills
    .filter((bill) => OPEN_STATUSES.includes(bill.status))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  const openTotal = openBills.reduce((s, b) => s + b.amount, 0);
  const nextOpen = openBills[0];
  const value = property.currentEstimatedValue;
  const gain =
    value != null && property.purchasePrice != null
      ? value - property.purchasePrice
      : null;
  const grossYield =
    value && monthlyRent > 0 ? ((monthlyRent * 12) / value) * 100 : null;

  const location = [property.city, property.state].filter(Boolean).join(", ");
  const address = [
    property.addressLine1,
    property.addressLine2,
    property.city,
    property.state,
    property.pinCode,
    property.country,
  ]
    .filter(Boolean)
    .join(", ");

  const sections = [
    { label: "Overview", href: `/properties/${id}`, current: true },
    { label: "Leases", href: `/properties/${id}/leases` },
    { label: "Rental units", href: `/properties/${id}/rentals` },
    { label: "Utilities & bills", href: `/properties/${id}/utilities` },
  ];

  return (
    <>
      <header className="space-y-4">
        <Breadcrumbs items={propertyCrumbs(property)} />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex size-16 shrink-0 items-center justify-center rounded-card bg-accent-soft text-accent">
              <PropertiesIcon className="size-8" strokeWidth={1.5} />
            </span>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-[1.875rem] leading-tight font-semibold tracking-[-0.02em] text-ink">
                  {property.name}
                </h1>
                <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-strong">
                  {PROPERTY_TYPE_LABELS[property.type]}
                </span>
                {openIssues.length > 0 && (
                  <a
                    href="#issues"
                    className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn"
                  >
                    {openIssues.length} open{" "}
                    {openIssues.length === 1 ? "issue" : "issues"}
                  </a>
                )}
              </div>
              <p className="text-sm text-muted">
                {[
                  property.propertyCategory &&
                    PROPERTY_CATEGORY_LABELS[property.propertyCategory],
                  location,
                  property.ownershipType &&
                    `${OWNERSHIP_TYPE_LABELS[property.ownershipType]} ownership`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button href={`/properties/${id}/edit`} variant="outline">
              Edit property
            </Button>
            <Dropdown>
              <DropdownButton>
                Manage
                <ChevronDownIcon />
              </DropdownButton>
              <DropdownMenu anchor="bottom end">
                <DropdownItem href={`/properties/${id}/leases/new`}>
                  Add a lease
                </DropdownItem>
                <DropdownItem href={`/properties/${id}/rentals/new`}>
                  Add a rental unit
                </DropdownItem>
                <DropdownItem href={`/properties/${id}/utilities/new`}>
                  Add a utility
                </DropdownItem>
                <DropdownItem href={`/properties/${id}/issues/new`}>
                  Add an issue
                </DropdownItem>
                <DropdownItem href={`/properties/${id}/dues/new`}>
                  Add a future payment
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        </div>
      </header>

      <section
        aria-label="Key figures"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          label="Current value"
          value={value != null ? money(value) : "—"}
          hint={
            gain != null ? (
              <span
                className={clsx(
                  "font-semibold",
                  gain >= 0 ? "text-accent" : "text-danger",
                )}
              >
                {gain >= 0 ? "+" : "−"}
                {money(Math.abs(gain))} since purchase
              </span>
            ) : (
              "Add a purchase price to track gain"
            )
          }
        />
        <StatCard
          label="Monthly rent"
          value={monthlyRent > 0 ? money(monthlyRent) : "—"}
          hint={
            activeLeases.length > 0
              ? `${activeLeases.length} active ${activeLeases.length === 1 ? "lease" : "leases"}`
              : "Not rented out"
          }
        />
        <StatCard
          label="Gross rental yield"
          value={grossYield != null ? `${grossYield.toFixed(1)}%` : "—"}
          hint={
            monthlyRent > 0 ? `${money(monthlyRent * 12)} a year` : undefined
          }
        />
        <StatCard
          label="Open bills"
          value={money(openTotal)}
          hint={
            nextOpen ? (
              <span
                className={clsx(
                  "font-semibold",
                  daysUntil(nextOpen.dueDate, new Date(), timeZone) < 0
                    ? "text-danger"
                    : "text-warn",
                )}
              >
                Next: {formatDueIn(nextOpen.dueDate, new Date(), timeZone)}
              </span>
            ) : (
              "Nothing outstanding"
            )
          }
        />
      </section>

      <nav
        aria-label="Property sections"
        className="flex flex-wrap gap-6 border-b border-line"
      >
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            aria-current={section.current ? "page" : undefined}
            className={clsx(
              "pt-1 pb-3 text-sm",
              section.current
                ? "font-semibold text-ink shadow-[inset_0_-2px_0_var(--color-accent)]"
                : "font-medium text-muted hover:text-ink",
            )}
          >
            {section.label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {activeLeases.length > 0 && (
            <Card aria-labelledby="leases">
              <CardHeader
                title={<span id="leases">Current lease</span>}
                action={
                  <Link
                    href={`/properties/${id}/leases`}
                    className="hover:text-accent-strong"
                  >
                    Manage leases
                  </Link>
                }
              />
              <ul className="divide-y divide-line-soft">
                {activeLeases.map((lease) => (
                  <li
                    key={lease.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sunken-2 text-sm font-semibold text-ink-2">
                      {initials(lease.tenantName)}
                    </span>
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="text-[0.9375rem] font-semibold text-ink">
                        {lease.tenantName}
                      </p>
                      <p className="text-[0.8125rem] text-muted">
                        {lease.room?.label ?? "Whole property"} · since{" "}
                        {formatDate(lease.leaseStart)}
                        {lease.depositAmount > 0 &&
                          ` · deposit ${money(lease.depositAmount)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[0.9375rem] font-semibold text-ink">
                        {money(lease.rentAmount)}
                      </p>
                      <p className="text-xs text-muted">
                        {lease.rentDueDay
                          ? `per month · due on the ${ordinal(lease.rentDueDay)}`
                          : "per month"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card aria-labelledby="issues">
            <CardHeader
              title={<span id="issues">Issues</span>}
              action={
                <Link
                  href={`/properties/${id}/issues/new`}
                  className="hover:text-accent-strong"
                >
                  Add issue
                </Link>
              }
            />
            {issues.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted">
                Nothing open on this property. If there&apos;s a dispute, a
                pending freehold conversion or dues still to pay, add it here to
                track its dates and payments and be reminded of them.
              </p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {issues.map((issue) => {
                  const next = nextKeyDate(issue.keyDates, today);
                  return (
                    <li
                      key={issue.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6"
                    >
                      <div className="min-w-0 flex-1 basis-56">
                        <Link
                          href={`/properties/${id}/issues/${issue.id}`}
                          className="text-[0.9375rem] font-semibold text-ink hover:text-accent-strong"
                        >
                          {issue.title}
                        </Link>
                        <p className="text-[0.8125rem] text-muted">
                          {ISSUE_TYPE_LABELS[issue.type]}
                          {issue.status === "OPEN"
                            ? next
                              ? ` · ${next.label} ${formatDate(next.date)}`
                              : issue.nextDue
                                ? ` · next payment ${formatDate(issue.nextDue.dueDate)}`
                                : " · nothing scheduled"
                            : issue.resolvedOn
                              ? ` · closed ${formatDate(issue.resolvedOn)}`
                              : ""}
                        </p>
                      </div>
                      {issue.owed > 0 && (
                        <div className="text-right">
                          <p className="text-[0.9375rem] font-semibold text-ink">
                            {money(issue.owed)}
                          </p>
                          <p className="text-xs text-muted">still to pay</p>
                        </div>
                      )}
                      <StatusBadge status={issue.status} />
                    </li>
                  );
                })}
              </ul>
            )}
            {closedIssues > 0 && openIssues.length === 0 && (
              <p className="border-t border-line-soft px-6 py-3 text-xs text-muted">
                No open issues. {closedIssues} closed, kept as history.
              </p>
            )}
          </Card>

          <Card aria-labelledby="bills">
            <CardHeader
              title={<span id="bills">Bills</span>}
              action={
                <span className="flex flex-wrap gap-x-4 gap-y-1">
                  <Link
                    href={`/properties/${id}/dues/new`}
                    className="hover:text-accent-strong"
                  >
                    Add future payment
                  </Link>
                  <Link
                    href={`/properties/${id}/utilities`}
                    className="hover:text-accent-strong"
                  >
                    Utilities & bills →
                  </Link>
                </span>
              }
            />
            {bills.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted">
                No bills on record for this property yet — utility bills, rent
                and EMIs from a linked loan will all show up here.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-136 text-sm">
                  <thead>
                    <tr className="bg-sunken text-left text-xs text-muted">
                      <th scope="col" className="px-6 py-2.5 font-semibold">
                        Bill
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">
                        Due
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">
                        Status
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-2.5 text-right font-semibold"
                      >
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {bills.map((bill) => (
                      <tr key={bill.id}>
                        <td className="px-6 py-3.5">
                          <Link
                            href={`/bills/${bill.id}`}
                            className="font-medium text-ink hover:text-accent-strong"
                          >
                            {bill.description ??
                              EVENT_CATEGORY_LABELS[bill.category]}
                          </Link>
                          <p className="text-xs text-muted">
                            {EVENT_CATEGORY_LABELS[bill.category]}
                          </p>
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap text-muted">
                          {formatDate(bill.dueDate)}
                        </td>
                        <td className="px-3 py-3.5">
                          <StatusBadge status={bill.status} />
                        </td>
                        <td className="px-6 py-3.5 text-right font-semibold whitespace-nowrap text-ink">
                          {bill.direction === "INFLOW" && "+"}
                          {money(bill.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <Card aria-labelledby="details" className="space-y-3.5 p-5 sm:p-6">
          <h2 id="details" className="text-base font-semibold text-ink">
            Details
          </h2>
          <dl className="space-y-3 text-sm">
            <DetailRow label="Address" value={address} />
            <DetailRow
              label="Purchase price"
              value={
                property.purchasePrice != null
                  ? money(property.purchasePrice)
                  : undefined
              }
            />
            <DetailRow
              label="Purchased"
              value={
                property.purchaseDate
                  ? formatDate(property.purchaseDate)
                  : undefined
              }
            />
            <DetailRow
              label="Category"
              value={
                property.propertyCategory
                  ? PROPERTY_CATEGORY_LABELS[property.propertyCategory]
                  : undefined
              }
            />
            <DetailRow
              label="Ownership"
              value={
                property.ownershipType
                  ? OWNERSHIP_TYPE_LABELS[property.ownershipType]
                  : undefined
              }
            />
            <DetailRow
              label="Property ID"
              value={property.uniquePropertyId ?? undefined}
            />
          </dl>
          {property.notes && (
            <div className="space-y-1 border-t border-line-soft pt-3.5">
              <h3 className="text-sm font-medium text-ink">Notes</h3>
              <p className="text-sm whitespace-pre-line text-muted">
                {property.notes}
              </p>
            </div>
          )}
          {property.ownershipType === "LEASEHOLD" && (
            <form
              action={setFreeholdAlerts.bind(
                null,
                id,
                !property.freeholdAlertsSince,
              )}
              className="space-y-2.5 border-t border-line-soft pt-3.5"
            >
              <p className="text-sm font-medium text-ink">
                Freehold reminders are{" "}
                {property.freeholdAlertsSince ? "on" : "off"}
              </p>
              <p className="text-xs text-muted">
                {property.freeholdAlertsSince
                  ? "You get a check-in email every 6 months until this property is converted to freehold."
                  : "Optional: a check-in email every 6 months to look at converting this property to freehold."}
              </p>
              <SubmitButton size="sm" variant="outline">
                {property.freeholdAlertsSince ? "Turn off" : "Remind me"}
              </SubmitButton>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value ?? "—"}</dd>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function ordinal(day: number) {
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  return `${day}${suffix}`;
}
