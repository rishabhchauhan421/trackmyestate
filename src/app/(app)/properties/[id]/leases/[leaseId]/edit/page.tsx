import { notFound, redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { SubmitButton } from "~/app/_components/submit-button";
import { FormActions, controlClass, labelClass } from "~/app/_components/form";
import { PageHeader, propertyCrumbs } from "~/app/_components/page-header";
import { toDateInputValue } from "~/lib/format";
import { deleteLease, endLease, updateLease } from "~/server/actions/leases";
import { getSession } from "~/server/better-auth/server";
import { getDocumentsForLease } from "~/server/queries/documents";
import { getLeaseForOwner, hasBillsForLease } from "~/server/queries/leases";
import { getPropertyForOwner } from "~/server/queries/properties";
import { getRoomsForProperty } from "~/server/queries/rentals";

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
  if (lease?.propertyId !== id) {
    notFound();
  }

  const [rooms, canDelete, documents] = await Promise.all([
    getRoomsForProperty(id),
    hasBillsForLease(leaseId).then((hasBills) => !hasBills),
    getDocumentsForLease(leaseId, session.user.id),
  ]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          ...propertyCrumbs(property, "Leases"),
          { label: "Edit lease" },
        ]}
        title={`Edit lease for ${lease.tenantName}`}
        description="Change this lease's terms, end it, or remove it if it was added by mistake."
      />

      <form
        action={updateLease.bind(null, lease.id)}
        data-gtm-event="lease_updated"
        className="max-w-3xl space-y-5 rounded-card border border-line bg-surface p-6"
      >
        {rooms.length > 0 && (
          <label className="block">
            <span className={labelClass}>Rental unit</span>
            <select
              name="roomId"
              defaultValue={lease.roomId ?? ""}
              className={controlClass}
            >
              <option value="">Entire property</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Rent amount (₹/month)</span>
            <input
              type="number"
              name="rentAmount"
              min="1"
              step="1"
              required
              defaultValue={lease.rentAmount}
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Deposit amount (₹)</span>
            <input
              type="number"
              name="depositAmount"
              min="0"
              step="1"
              required
              defaultValue={lease.depositAmount}
              className={controlClass}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Lease end (optional)</span>
            <input
              type="date"
              name="leaseEnd"
              defaultValue={
                lease.leaseEnd ? toDateInputValue(lease.leaseEnd) : ""
              }
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Rent due day (optional)</span>
            <input
              type="number"
              name="rentDueDay"
              min="1"
              max="31"
              step="1"
              placeholder="e.g. 5"
              defaultValue={lease.rentDueDay ?? ""}
              className={controlClass}
            />
          </label>
        </div>

        <FormActions>
          <Button href={`/properties/${id}/leases`} variant="outline">
            Cancel
          </Button>
          <SubmitButton>Save changes</SubmitButton>
        </FormActions>
      </form>

      <div className="max-w-3xl space-y-4 rounded-card border border-line bg-surface p-6">
        <div>
          <p className="text-sm font-semibold text-ink">End lease</p>
          <p className="mt-1 text-xs text-muted">
            {lease.active
              ? "Marks this lease inactive. The record is kept for history."
              : "This lease has already ended."}
          </p>
        </div>
        <form
          action={endLease.bind(null, lease.id)}
          data-gtm-event="lease_ended"
        >
          <SubmitButton
            variant="outline"
            color="amber"
            disabled={!lease.active}
            title={lease.active ? undefined : "This lease has already ended"}
          >
            End lease
          </SubmitButton>
        </form>
      </div>

      <div className="max-w-3xl space-y-4 rounded-card border border-line bg-surface p-6">
        <div>
          <p className="text-sm font-semibold text-ink">Delete lease</p>
          <p className="mt-1 text-xs text-muted">
            {canDelete
              ? "Permanently removes this lease. Only possible when it has no bills on record."
              : "This lease has bills on record, so it can't be deleted — end the lease instead."}
          </p>
        </div>
        <form
          action={deleteLease.bind(null, lease.id)}
          data-gtm-event="lease_deleted"
        >
          <SubmitButton
            variant="outline"
            color="red"
            disabled={!canDelete}
            title={canDelete ? undefined : "Bills exist for this lease"}
          >
            Delete lease
          </SubmitButton>
        </form>
      </div>

      <label className="block max-w-xl space-y-2 rounded-card border border-line bg-surface p-6">
        <span className={labelClass}>
          Documents attached ({documents.length})
        </span>
        <select disabled={documents.length === 0} className={controlClass}>
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
      </label>
    </>
  );
}
