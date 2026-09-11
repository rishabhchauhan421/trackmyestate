import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { EmptyState } from "~/app/_components/empty-state";
import { PropertiesIcon } from "~/app/_components/icons";
import { PageHeader } from "~/app/_components/page-header";
import { StatusBadge } from "~/app/_components/status-badge";
import { getSession } from "~/server/better-auth/server";
import { getPropertyForOwner, getRoomsForProperty } from "~/server/queries";

export default async function PropertyRentalsPage({
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

  const isSelfOccupied = property.type === "SELF_OCCUPIED";
  const rooms = isSelfOccupied ? [] : await getRoomsForProperty(id);

  return (
    <>
      <div>
        <Link
          href={`/properties/${id}`}
          className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          ← {property.name}
        </Link>
      </div>

      <PageHeader
        title={`${property.name} — Rental units`}
        description="Subdivisions of this property that get rented out individually — add one per room, unit or floor before assigning tenants."
        action={
          isSelfOccupied ? (
            <button
              type="button"
              disabled
              title="Self-occupied properties can't have rental units"
              className="cursor-not-allowed rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white opacity-40"
            >
              Add rental unit
            </button>
          ) : (
            <Link
              href={`/properties/${id}/rentals/new`}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
            >
              Add rental unit
            </Link>
          )
        }
      />

      {isSelfOccupied ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          This property is marked self-occupied, so it can&apos;t have rental
          units or tenants.
        </p>
      ) : rooms.length === 0 ? (
        <EmptyState
          Icon={PropertiesIcon}
          title="No rental units yet"
          description="Add a rental unit for each room, floor or unit you rent out separately, then assign a tenant to it."
          actionLabel="Add your first rental unit"
          actionHref={`/properties/${id}/rentals/new`}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                    {room.label}
                  </p>
                  {room.floor && (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {room.floor}
                      {room.areaSqft != null && <> · {room.areaSqft} sqft</>}
                    </p>
                  )}
                </div>
                <StatusBadge status={room.occupancyStatus} />
              </div>
              <Link
                href={`/properties/${id}/tenants/new?roomId=${room.id}`}
                className="mt-4 inline-block text-xs font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                Add tenant →
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
