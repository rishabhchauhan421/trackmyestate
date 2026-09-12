import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { PageHeader } from "~/app/_components/page-header";
import { toDateInputValue } from "~/lib/format";
import { deleteLease, endLease, updateLease } from "~/server/actions/leases";
import { getSession } from "~/server/better-auth/server";
import { getDocumentsForLease } from "~/server/queries/documents";
import { getLeaseForOwner, hasBillsForLease } from "~/server/queries/leases";
import { getPropertyForOwner } from "~/server/queries/properties";
import { getRoomsForProperty } from "~/server/queries/rentals";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const labelClass = "text-xs font-medium text-slate-600 dark:text-slate-300";

export default async function EditLeasePage({
  params,
}: {
  params: Promise<{ id: string; leaseId: string }>;
}) {
  const { id, leaseId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const property = await getPropertyForOwner(id, session.user.id);
  if (!property) {
    notFound();
  }

  const lease = await getLeaseForOwner(leaseId, session.user.id);
  if (!lease || lease.propertyId !== id) {
    notFound();
  }

  const [rooms, canDelete, documents] = await Promise.all([
    getRoomsForProperty(id),
    hasBillsForLease(leaseId).then((hasBills) => !hasBills),
    getDocumentsForLease(leaseId, session.user.id),
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
        title={`Edit lease for ${lease.tenantName}`}
        description="Change this lease's terms, end it, or remove it if it was added by mistake."
      />

      <form
        action={updateLease.bind(null, lease.id)}
        className="max-w-xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        {rooms.length > 0 && (
          <div>
            <label className={labelClass}>Rental unit</label>
            <select
              name="roomId"
              defaultValue={lease.roomId ?? ""}
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
              defaultValue={lease.rentAmount}
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
              defaultValue={lease.depositAmount}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Lease end (optional)</label>
            <input
              type="date"
              name="leaseEnd"
              defaultValue={
                lease.leaseEnd ? toDateInputValue(lease.leaseEnd) : ""
              }
              className={inputClass}
            />
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
              defaultValue={lease.rentDueDay ?? ""}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit">Save changes</Button>
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
            {lease.active
              ? "Marks this lease inactive. The record is kept for history."
              : "This lease has already ended."}
          </p>
        </div>
        <form action={endLease.bind(null, lease.id)}>
          <Button
            type="submit"
            variant="outline"
            color="amber"
            disabled={!lease.active}
            title={lease.active ? undefined : "This lease has already ended"}
          >
            End lease
          </Button>
        </form>
      </div>

      <div className="max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Delete lease
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {canDelete
              ? "Permanently removes this lease. Only possible when it has no bills on record."
              : "This lease has bills on record, so it can't be deleted — end the lease instead."}
          </p>
        </div>
        <form action={deleteLease.bind(null, lease.id)}>
          <Button
            type="submit"
            variant="outline"
            color="red"
            disabled={!canDelete}
            title={canDelete ? undefined : "Bills exist for this lease"}
          >
            Delete lease
          </Button>
        </form>
      </div>

      <div className="max-w-xl space-y-2 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <label className={labelClass}>
          Documents attached ({documents.length})
        </label>
        <select disabled={documents.length === 0} className={inputClass}>
          {documents.length === 0 ? (
            <option>No documents attached</option>
          ) : (
            documents.map((document) => (
              <option key={document.id} value={document.id}>
                {document.fileName}
              </option>
            ))
          )}
        </select>
      </div>
    </>
  );
}
