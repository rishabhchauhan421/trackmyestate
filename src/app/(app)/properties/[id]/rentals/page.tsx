import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { EmptyState } from "~/app/_components/empty-state";
import { PropertiesIcon } from "~/app/_components/icons";
import { PageHeader, propertyCrumbs } from "~/app/_components/page-header";
import { StatusBadge } from "~/app/_components/status-badge";
import { getSession } from "~/server/better-auth/server";
import { getPropertyForOwner } from "~/server/queries/properties";
import { getRoomsForProperty } from "~/server/queries/rentals";

export default async function PropertyRentalsPage({
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

  const isSelfOccupied = property.type === "SELF_OCCUPIED";
  const rooms = isSelfOccupied ? [] : await getRoomsForProperty(id);

  return (
    <>
      <PageHeader
        breadcrumbs={[...propertyCrumbs(property), { label: "Rental units" }]}
        title={`${property.name} — Rental units`}
        description="Subdivisions of this property that get rented out individually — add one per room, unit or floor before creating a lease for it."
        action={
          isSelfOccupied ? (
            <Button
              type="button"
              disabled
              title="Self-occupied properties can't have rental units"
            >
              Add rental unit
            </Button>
          ) : (
            <Button href={`/properties/${id}/rentals/new`}>
              Add rental unit
            </Button>
          )
        }
      />

      {isSelfOccupied ? (
        <p className="text-sm text-muted">
          This property is marked self-occupied, so it can&apos;t have rental
          units or leases.
        </p>
      ) : rooms.length === 0 ? (
        <EmptyState
          Icon={PropertiesIcon}
          title="No rental units yet"
          description="Add a rental unit for each room, floor or unit you rent out separately, then create a lease for it."
          actionLabel="Add your first rental unit"
          actionHref={`/properties/${id}/rentals/new`}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="rounded-card border border-line bg-surface p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {room.label}
                  </p>
                  {room.floor && (
                    <p className="mt-0.5 text-xs text-muted">
                      {room.floor}
                      {room.areaSqft != null && <> · {room.areaSqft} sqft</>}
                    </p>
                  )}
                </div>
                <StatusBadge status={room.occupancyStatus} />
              </div>
              <Link
                href={`/properties/${id}/leases/new?roomId=${room.id}`}
                className="mt-4 inline-block text-xs font-medium text-accent hover:text-accent-strong"
              >
                Add lease →
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
