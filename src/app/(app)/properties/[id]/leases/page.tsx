import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "~/app/_components/button";
import { PageHeader, propertyCrumbs } from "~/app/_components/page-header";
import { StatusBadge } from "~/app/_components/status-badge";
import { formatDate, formatMoney } from "~/lib/format";
import { requireScope } from "~/server/households";
import { getUserCurrency } from "~/server/queries/settings";
import { getLeasesForProperty } from "~/server/queries/leases";
import { getPropertyForHousehold } from "~/server/queries/properties";

export default async function PropertyLeasesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scope = await requireScope();
  const currency = await getUserCurrency(scope.userId);

  const property = await getPropertyForHousehold(id, scope.householdId);
  if (!property) {
    notFound();
  }

  const isSelfOccupied = property.type === "SELF_OCCUPIED";
  const leases = isSelfOccupied ? [] : await getLeasesForProperty(id);
  const currentLeases = leases.filter((lease) => lease.active);
  const pastLeases = leases.filter((lease) => !lease.active);

  return (
    <>
      <PageHeader
        breadcrumbs={[...propertyCrumbs(property), { label: "Leases" }]}
        title={`${property.name} — Leases`}
        description="Every lease this property has had — active and past."
        action={
          isSelfOccupied ? (
            <Button
              type="button"
              disabled
              title="Self-occupied properties can't have leases"
            >
              Add lease
            </Button>
          ) : (
            <Button href={`/properties/${id}/leases/new`}>Add lease</Button>
          )
        }
      />

      {isSelfOccupied ? (
        <p className="text-sm text-muted">
          This property is self-occupied, so it can&apos;t have leases.
        </p>
      ) : (
        <>
          <div>
            <h2 className="mb-3 text-sm font-semibold text-ink">
              Active leases
            </h2>
            {currentLeases.length === 0 ? (
              <p className="text-sm text-muted">
                No active lease — this property is currently vacant.
              </p>
            ) : (
              <div className="overflow-hidden rounded-card border border-line bg-surface">
                <ul className="divide-y divide-line-soft">
                  {currentLeases.map((lease) => (
                    <li
                      key={lease.id}
                      className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {lease.tenantName}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {lease.tenantPhone}
                          {lease.tenantEmail && <> · {lease.tenantEmail}</>}
                          {lease.room && <> · {lease.room.label}</>}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-ink">
                          {formatMoney(
                            lease.rentAmount,
                            lease.currency ?? currency,
                          )}
                          /mo
                        </p>
                        <p className="text-xs text-muted">
                          since {formatDate(lease.leaseStart)}
                          {lease.rentDueDay != null && (
                            <> · due day {lease.rentDueDay}</>
                          )}
                        </p>
                      </div>
                      <StatusBadge status="ACTIVE" />
                      <Link
                        href={`/properties/${id}/leases/${lease.id}/edit`}
                        className="text-xs font-medium text-accent hover:text-accent-strong"
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
            <h2 className="mb-3 text-sm font-semibold text-ink">Past leases</h2>
            {pastLeases.length === 0 ? (
              <p className="text-sm text-muted">No past leases on record.</p>
            ) : (
              <div className="overflow-hidden rounded-card border border-line bg-surface">
                <ul className="divide-y divide-line-soft">
                  {pastLeases.map((lease) => (
                    <li
                      key={lease.id}
                      className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {lease.tenantName}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {formatDate(lease.leaseStart)} –{" "}
                          {lease.leaseEnd ? formatDate(lease.leaseEnd) : "—"}
                          {lease.room && <> · {lease.room.label}</>}
                        </p>
                      </div>
                      <p className="text-sm font-medium text-muted">
                        {formatMoney(
                          lease.rentAmount,
                          lease.currency ?? currency,
                        )}
                        /mo
                      </p>
                      <StatusBadge status="PAST" />
                      <Link
                        href={`/properties/${id}/leases/${lease.id}/edit`}
                        className="text-xs font-medium text-accent hover:text-accent-strong"
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
      )}
    </>
  );
}
