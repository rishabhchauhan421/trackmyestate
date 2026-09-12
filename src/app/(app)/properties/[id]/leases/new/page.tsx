import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { PageHeader } from "~/app/_components/page-header";
import { createLease } from "~/server/actions/leases";
import { getSession } from "~/server/better-auth/server";
import { getPropertyForOwner } from "~/server/queries/properties";
import { getRoomsForProperty } from "~/server/queries/rentals";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const labelClass = "text-xs font-medium text-slate-600 dark:text-slate-300";

export default async function NewLeasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { roomId } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");
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
        title="Add lease"
        description="Start a new lease for this property — the whole property, or one of its rental units."
      />

      <form
        action={createLease}
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
            <label className={labelClass}>Tenant name</label>
            <input
              type="text"
              name="tenantName"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Tenant phone</label>
            <input
              type="tel"
              name="tenantPhone"
              required
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Tenant email (optional)</label>
          <input type="email" name="tenantEmail" className={inputClass} />
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

        <div>
          <label className={labelClass}>Rent due day (optional)</label>
          <input
            type="number"
            name="rentDueDay"
            min="1"
            max="31"
            step="1"
            placeholder="e.g. 5"
            className={`${inputClass} sm:w-40`}
          />
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Day of the month rent is due — for display only.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit">Save lease</Button>
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
