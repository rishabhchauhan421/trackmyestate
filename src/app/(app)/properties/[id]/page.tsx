import { ChevronDownIcon } from "@heroicons/react/16/solid";
import clsx from "clsx";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

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
import { daysUntil, formatDate, formatDueIn, formatINR } from "~/lib/format";
import {
  EVENT_CATEGORY_LABELS,
  OWNERSHIP_TYPE_LABELS,
  PROPERTY_CATEGORY_LABELS,
  PROPERTY_TYPE_LABELS,
} from "~/lib/labels";
import { getSession } from "~/server/better-auth/server";
import { getUserTimeZone } from "~/server/queries/settings";
import { getAllBillsForProperty } from "~/server/queries/bills";
import { getLeasesForProperty } from "~/server/queries/leases";
import { getPropertyForOwner } from "~/server/queries/properties";
import { OPEN_PAYMENT_STATUSES } from "~/server/queries/shared";

const OPEN_STATUSES: readonly string[] = OPEN_PAYMENT_STATUSES;

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const property = await getPropertyForOwner(id, session.user.id);
  if (!property) {
    notFound();
  }

  const [bills, leases, timeZone] = await Promise.all([
    getAllBillsForProperty(id),
    getLeasesForProperty(id),
    getUserTimeZone(session.user.id),
  ]);

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
          value={value != null ? formatINR(value) : "—"}
          hint={
            gain != null ? (
              <span
                className={clsx(
                  "font-semibold",
                  gain >= 0 ? "text-accent" : "text-danger",
                )}
              >
                {gain >= 0 ? "+" : "−"}
                {formatINR(Math.abs(gain))} since purchase
              </span>
            ) : (
              "Add a purchase price to track gain"
            )
          }
        />
        <StatCard
          label="Monthly rent"
          value={monthlyRent > 0 ? formatINR(monthlyRent) : "—"}
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
            monthlyRent > 0
              ? `${formatINR(monthlyRent * 12)} a year`
              : undefined
          }
        />
        <StatCard
          label="Open bills"
          value={formatINR(openTotal)}
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
                        {formatDate(lease.leaseStart)} · deposit{" "}
                        {formatINR(lease.depositAmount)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[0.9375rem] font-semibold text-ink">
                        {formatINR(lease.rentAmount)}
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

          <Card aria-labelledby="bills">
            <CardHeader
              title={<span id="bills">Bills</span>}
              action={
                <Link
                  href={`/properties/${id}/utilities`}
                  className="hover:text-accent-strong"
                >
                  Utilities & bills →
                </Link>
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
                          <p className="font-medium text-ink">
                            {bill.description ??
                              EVENT_CATEGORY_LABELS[bill.category]}
                          </p>
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
                          {formatINR(bill.amount)}
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
                  ? formatINR(property.purchasePrice)
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
