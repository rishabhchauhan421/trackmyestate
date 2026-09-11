import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "~/app/_components/page-header";
import { StatusBadge } from "~/app/_components/status-badge";
import { formatDate, formatINR } from "~/lib/format";
import { PROPERTY_TYPE_LABELS } from "~/lib/labels";
import { getSession } from "~/server/better-auth/server";
import { getPropertyForOwner, getTenantsForProperty } from "~/server/queries";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/");

  const property = await getPropertyForOwner(id, session.user.id);
  if (!property) {
    notFound();
  }

  const tenants = await getTenantsForProperty(id);
  const currentTenants = tenants.filter((tenant) => tenant.active);
  const pastTenants = tenants.filter((tenant) => !tenant.active);
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
            <Link
              href={`/properties/${id}/utilities`}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Utilities →
            </Link>
            <Link
              href={`/properties/${id}/rentals`}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Rental units →
            </Link>
            {isSelfOccupied ? (
              <button
                type="button"
                disabled
                title="Self-occupied properties can't have tenants"
                className="cursor-not-allowed rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white opacity-40"
              >
                Add tenant
              </button>
            ) : (
              <Link
                href={`/properties/${id}/tenants/new`}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
              >
                Add tenant
              </Link>
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
          Current tenants
        </h2>
        {currentTenants.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isSelfOccupied
              ? "This property is self-occupied, so it can't have tenants."
              : "No active tenant — this property is currently vacant."}
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {currentTenants.map((tenant) => (
                <li
                  key={tenant.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {tenant.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {tenant.phone}
                      {tenant.email && <> · {tenant.email}</>}
                      {tenant.room && <> · {tenant.room.label}</>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {formatINR(tenant.rentAmount)}/mo
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      since {formatDate(tenant.leaseStart)}
                    </p>
                  </div>
                  <StatusBadge status="ACTIVE" />
                  <Link
                    href={`/properties/${id}/tenants/${tenant.id}/edit`}
                    className="text-xs font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
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
          Past tenants
        </h2>
        {pastTenants.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No past tenants on record.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {pastTenants.map((tenant) => (
                <li
                  key={tenant.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {tenant.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(tenant.leaseStart)} –{" "}
                      {tenant.leaseEnd ? formatDate(tenant.leaseEnd) : "—"}
                      {tenant.room && <> · {tenant.room.label}</>}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                    {formatINR(tenant.rentAmount)}/mo
                  </p>
                  <StatusBadge status="PAST" />
                  <Link
                    href={`/properties/${id}/tenants/${tenant.id}/edit`}
                    className="text-xs font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
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
