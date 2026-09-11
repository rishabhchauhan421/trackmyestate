import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "~/app/_components/page-header";
import { toDateInputValue } from "~/lib/format";
import { deleteTenant, endLease, updateTenant } from "~/server/actions/tenants";
import { getSession } from "~/server/better-auth/server";
import {
  getPropertyForOwner,
  getRoomsForProperty,
  getTenantForOwner,
  hasBillsForTenant,
} from "~/server/queries";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const labelClass = "text-xs font-medium text-slate-600 dark:text-slate-300";

export default async function EditTenantPage({
  params,
}: {
  params: Promise<{ id: string; tenantId: string }>;
}) {
  const { id, tenantId } = await params;
  const session = await getSession();
  if (!session) redirect("/");

  const property = await getPropertyForOwner(id, session.user.id);
  if (!property) {
    notFound();
  }

  const tenant = await getTenantForOwner(tenantId, session.user.id);
  if (!tenant || tenant.propertyId !== id) {
    notFound();
  }

  const [rooms, canDelete] = await Promise.all([
    getRoomsForProperty(id),
    hasBillsForTenant(tenantId).then((hasBills) => !hasBills),
  ]);

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
        title={`Edit ${tenant.name}'s lease`}
        description="Change this lease's terms, end it, or remove the tenant if it was added by mistake."
      />

      <form
        action={updateTenant.bind(null, tenant.id)}
        className="max-w-xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        {rooms.length > 0 && (
          <div>
            <label className={labelClass}>Rental unit</label>
            <select
              name="roomId"
              defaultValue={tenant.roomId ?? ""}
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
            <label className={labelClass}>Rent amount (₹/month)</label>
            <input
              type="number"
              name="rentAmount"
              min="1"
              step="1"
              required
              defaultValue={tenant.rentAmount}
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
              defaultValue={tenant.depositAmount}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Lease end (optional)</label>
          <input
            type="date"
            name="leaseEnd"
            defaultValue={
              tenant.leaseEnd ? toDateInputValue(tenant.leaseEnd) : ""
            }
            className={`${inputClass} sm:w-56`}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
          >
            Save changes
          </button>
          <Link
            href={`/properties/${id}`}
            className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Cancel
          </Link>
        </div>
      </form>

      <div className="max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            End lease
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {tenant.active
              ? "Marks this tenant inactive. The lease record is kept for history."
              : "This lease has already ended."}
          </p>
        </div>
        <form action={endLease.bind(null, tenant.id)}>
          <button
            type="submit"
            disabled={!tenant.active}
            title={tenant.active ? undefined : "This lease has already ended"}
            className={
              tenant.active
                ? "rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/40"
                : "cursor-not-allowed rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-400 opacity-60 dark:border-slate-700 dark:text-slate-500"
            }
          >
            End lease
          </button>
        </form>
      </div>

      <div className="max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Delete tenant
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {canDelete
              ? "Permanently removes this tenant. Only possible when it has no bills on record."
              : "This tenant has bills on record, so it can't be deleted — end the lease instead."}
          </p>
        </div>
        <form action={deleteTenant.bind(null, tenant.id)}>
          <button
            type="submit"
            disabled={!canDelete}
            title={
              canDelete ? undefined : "Bills exist for this tenant"
            }
            className={
              canDelete
                ? "rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
                : "cursor-not-allowed rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-400 opacity-60 dark:border-slate-700 dark:text-slate-500"
            }
          >
            Delete tenant
          </button>
        </form>
      </div>
    </>
  );
}
