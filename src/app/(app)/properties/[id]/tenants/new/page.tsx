import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "~/app/_components/page-header";
import { createTenant } from "~/server/actions/tenants";
import { getSession } from "~/server/better-auth/server";
import { getPropertyForOwner, getRoomsForProperty } from "~/server/queries";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const labelClass = "text-xs font-medium text-slate-600 dark:text-slate-300";

export default async function NewTenantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { roomId } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/");
  const property = await getPropertyForOwner(id, session.user.id);
  if (!property) {
    notFound();
  }
  // Self-occupied properties can't be rented out — the link to this page
  // is disabled, but a direct visit still needs to be turned away.
  if (property.type === "SELF_OCCUPIED") {
    redirect(`/properties/${id}`);
  }

  const rooms = await getRoomsForProperty(id);
  const preselectedRoomId = typeof roomId === "string" ? roomId : "";

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
        title="Add tenant"
        description="Start a new lease for this property — the whole property, or one of its rental units."
      />

      <form
        action={createTenant}
        className="max-w-xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <input type="hidden" name="propertyId" value={id} />

        {rooms.length > 0 && (
          <div>
            <label className={labelClass}>Rental unit</label>
            <select
              name="roomId"
              defaultValue={preselectedRoomId}
              className={inputClass}
            >
              <option value="">Entire property</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Name</label>
            <input type="text" name="name" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input type="tel" name="phone" required className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Email (optional)</label>
          <input type="email" name="email" className={inputClass} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Lease start</label>
            <input
              type="date"
              name="leaseStart"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Lease end (optional)</label>
            <input type="date" name="leaseEnd" className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Rent amount (₹/month)</label>
            <input
              type="number"
              name="rentAmount"
              min="1"
              step="1"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Deposit amount (₹)</label>
            <input
              type="number"
              name="depositAmount"
              min="0"
              step="1"
              required
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
          >
            Save tenant
          </button>
          <Link
            href={`/properties/${id}`}
            className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
