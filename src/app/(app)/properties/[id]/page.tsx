import { ChevronDownIcon } from "@heroicons/react/16/solid";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownMenu,
} from "~/app/_components/dropdown";
import { PageHeader } from "~/app/_components/page-header";
import { StatusBadge } from "~/app/_components/status-badge";
import { formatDate, formatINR } from "~/lib/format";
import {
  EVENT_CATEGORY_LABELS,
  OWNERSHIP_TYPE_LABELS,
  PROPERTY_CATEGORY_LABELS,
  PROPERTY_TYPE_LABELS,
} from "~/lib/labels";
import { getSession } from "~/server/better-auth/server";
import { getAllBillsForProperty } from "~/server/queries/bills";
import { getPropertyForOwner } from "~/server/queries/properties";

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

  const bills = await getAllBillsForProperty(id);

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

  return (
    <>
      <div>
        <Link
          href="/properties"
          className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          ← Properties
        </Link>
      </div>

      <PageHeader
        title={property.name}
        description={address}
        action={
          <Dropdown>
            <DropdownButton variant="outline">
              Manage
              <ChevronDownIcon className="size-4" />
            </DropdownButton>
            <DropdownMenu anchor="bottom end">
              <DropdownItem href={`/properties/${id}/edit`}>
                Edit
              </DropdownItem>
              <DropdownItem href={`/properties/${id}/utilities`}>
                Utilities
              </DropdownItem>
              <DropdownItem href={`/properties/${id}/rentals`}>
                Rental units
              </DropdownItem>
              <DropdownItem href={`/properties/${id}/leases`}>
                Leases
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Type
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
            {PROPERTY_TYPE_LABELS[property.type]}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Current estimated value
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
            {property.currentEstimatedValue
              ? formatINR(property.currentEstimatedValue)
              : "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Purchased
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
            {property.purchaseDate ? formatDate(property.purchaseDate) : "—"}
            {property.purchasePrice != null && (
              <> · {formatINR(property.purchasePrice)}</>
            )}
          </p>
        </div>
      </div>

      {(property.uniquePropertyId ??
        property.propertyCategory ??
        property.ownershipType) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {property.uniquePropertyId && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Unique Property ID
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
                {property.uniquePropertyId}
              </p>
            </div>
          )}
          {property.propertyCategory && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Category
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
                {PROPERTY_CATEGORY_LABELS[property.propertyCategory]}
              </p>
            </div>
          )}
          {property.ownershipType && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Ownership type
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">
                {OWNERSHIP_TYPE_LABELS[property.ownershipType]}
              </p>
            </div>
          )}
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
          Open bills
        </h2>
        {bills.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No bills on record for this property yet — utility bills, rent
            and EMIs from a linked loan will all show up here.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {bills.map((bill) => (
                <li
                  key={bill.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {bill.description ?? EVENT_CATEGORY_LABELS[bill.category]}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {EVENT_CATEGORY_LABELS[bill.category]} · due{" "}
                      {formatDate(bill.dueDate)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {formatINR(bill.amount)}
                  </p>
                  <StatusBadge status={bill.status} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
