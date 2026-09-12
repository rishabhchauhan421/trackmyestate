import { ChevronDownIcon } from "@heroicons/react/16/solid";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import {
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownMenu,
} from "~/app/_components/dropdown";
import { EmptyState } from "~/app/_components/empty-state";
import { PropertiesIcon } from "~/app/_components/icons";
import { PageHeader } from "~/app/_components/page-header";
import { formatINR } from "~/lib/format";
import { PROPERTY_TYPE_LABELS } from "~/lib/labels";
import { getSession } from "~/server/better-auth/server";
import { getProperties } from "~/server/queries/properties";

export default async function PropertiesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const properties = await getProperties(session.user.id);

  return (
    <>
      <PageHeader
        title="Properties"
        description="Every home, rental and investment property — with its rent, bills, tenants and paper trail."
        action={<Button href="/properties/new">Add property</Button>}
      />

      {properties.length === 0 ? (
        <EmptyState
          Icon={PropertiesIcon}
          title="No properties yet"
          description="Add a property to start tracking rent, utility bills, occupancy and the loan or insurance linked to it."
          actionLabel="Add your first property"
          actionHref="/properties/new"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => {
            const lease = property.leases[0];
            const overdueAmount = property.openBills.reduce(
              (sum, bill) => sum + bill.amount,
              0,
            );
            return (
              <div
                key={property.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {property.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {property.city}, {property.state}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {PROPERTY_TYPE_LABELS[property.type]}
                  </span>
                </div>

                <p className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-50">
                  {property.currentEstimatedValue
                    ? formatINR(property.currentEstimatedValue)
                    : "—"}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Current estimated value
                </p>

                {lease && (
                  <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                    Rented to{" "}
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {lease.tenantName}
                    </span>{" "}
                    · {formatINR(lease.rentAmount)}/mo
                  </p>
                )}
                {overdueAmount > 0 && (
                  <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                    Overdue amount: {formatINR(overdueAmount)}
                  </p>
                )}

                <div className="mt-4 flex items-center justify-between gap-4">
                  <Link
                    href={`/properties/${property.id}`}
                    className="text-xs font-medium text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Details →
                  </Link>
                  <Dropdown>
                    <DropdownButton
                      variant="outline"
                      size="sm"
                      className="text-xs"
                    >
                      Manage
                      <ChevronDownIcon className="size-4" />
                    </DropdownButton>
                    <DropdownMenu anchor="bottom end">
                      <DropdownItem href={`/properties/${property.id}/edit`}>
                        Edit
                      </DropdownItem>
                      <DropdownItem href={`/properties/${property.id}/utilities`}>
                        Utilities
                      </DropdownItem>
                      <DropdownItem href={`/properties/${property.id}/rentals`}>
                        Rental units
                      </DropdownItem>
                      <DropdownItem href={`/properties/${property.id}/leases`}>
                        Leases
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
