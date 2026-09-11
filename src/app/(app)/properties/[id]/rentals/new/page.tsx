import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "~/app/_components/page-header";
import { createRental } from "~/server/actions/rentals";
import { getSession } from "~/server/better-auth/server";
import { getPropertyForOwner } from "~/server/queries";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const labelClass = "text-xs font-medium text-slate-600 dark:text-slate-300";

export default async function NewRentalPage({
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
  // Self-occupied properties can't have rental units — the link to this
  // page is disabled, but a direct visit still needs to be turned away.
  if (property.type === "SELF_OCCUPIED") {
    redirect(`/properties/${id}`);
  }

  return (
    <>
      <div>
        <Link
          href={`/properties/${id}/rentals`}
          className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          ← {property.name} rental units
        </Link>
      </div>

      <PageHeader
        title="Add rental unit"
        description="A room, floor or unit within this property that gets rented out on its own. Assign a tenant to it afterwards."
      />

      <form
        action={createRental}
        className="max-w-xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <input type="hidden" name="propertyId" value={id} />

        <div>
          <label className={labelClass}>Label</label>
          <input
            type="text"
            name="label"
            required
            placeholder="e.g. 2nd floor, Room B"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Floor (optional)</label>
            <input type="text" name="floor" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Area (sqft, optional)</label>
            <input
              type="number"
              name="areaSqft"
              min="1"
              step="1"
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
          >
            Save rental unit
          </button>
          <Link
            href={`/properties/${id}/rentals`}
            className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
