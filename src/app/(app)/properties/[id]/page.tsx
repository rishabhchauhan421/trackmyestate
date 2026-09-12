import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { PageHeader } from "~/app/_components/page-header";
import { StatusBadge } from "~/app/_components/status-badge";
import { formatDate, formatINR } from "~/lib/format";
import { PROPERTY_TYPE_LABELS } from "~/lib/labels";
import { getSession } from "~/server/better-auth/server";
import { getLeasesForProperty } from "~/server/queries/leases";
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

  const leases = await getLeasesForProperty(id);
  const currentLeases = leases.filter((lease) => lease.active);
  const pastLeases = leases.filter((lease) => !lease.active);
  const isSelfOccupied = property.type === "SELF_OCCUPIED";

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
          <div className="flex flex-wrap items-center gap-3">
            <Button href={`/properties/${id}/utilities`} variant="outline">
              Utilities →
            </Button>
            <Button href={`/properties/${id}/rentals`} variant="outline">
              Rental units →
            </Button>
            {isSelfOccupied ? (
              <Button
                type="button"
                disabled
                title="Self-occupied properties can't have leases"
              >
                Add lease
              </Button>
            ) : (
              <Button href={`/properties/${id}/leases/new`}>Add lease</Button>
            )}
          </div>
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

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
          Current leases
        </h2>
        {currentLeases.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isSelfOccupied
              ? "This property is self-occupied, so it can't have leases."
              : "No active lease — this property is currently vacant."}
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {currentLeases.map((lease) => (
                <li
                  key={lease.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {lease.tenantName}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {lease.tenantPhone}
                      {lease.tenantEmail && <> · {lease.tenantEmail}</>}
                      {lease.room && <> · {lease.room.label}</>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {formatINR(lease.rentAmount)}/mo
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      since {formatDate(lease.leaseStart)}
                      {lease.rentDueDay != null && (
                        <> · due day {lease.rentDueDay}</>
                      )}
                    </p>
                  </div>
                  <StatusBadge status="ACTIVE" />
                  <Link
                    href={`/properties/${id}/leases/${lease.id}/edit`}
                    className="text-xs font-medium text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Edit →
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
          Past leases
        </h2>
        {pastLeases.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No past leases on record.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {pastLeases.map((lease) => (
                <li
                  key={lease.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {lease.tenantName}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(lease.leaseStart)} –{" "}
                      {lease.leaseEnd ? formatDate(lease.leaseEnd) : "—"}
                      {lease.room && <> · {lease.room.label}</>}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {formatINR(lease.rentAmount)}/mo
                  </p>
                  <StatusBadge status="PAST" />
                  <Link
                    href={`/properties/${id}/leases/${lease.id}/edit`}
                    className="text-xs font-medium text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Edit →
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
