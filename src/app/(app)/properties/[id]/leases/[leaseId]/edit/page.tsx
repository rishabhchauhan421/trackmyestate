import { notFound } from "next/navigation";

import { ActionForm } from "~/app/_components/action-form";
import { Button } from "~/app/_components/button";
import { SubmitButton } from "~/app/_components/submit-button";
import { FormActions, controlClass, labelClass } from "~/app/_components/form";
import { PageHeader, propertyCrumbs } from "~/app/_components/page-header";
import { currencySymbol, toDateInputValue } from "~/lib/format";
import { fromMinorUnits } from "~/lib/money";
import {
  deleteLeaseForm,
  endLeaseForm,
  updateLeaseForm,
} from "~/server/actions/leases";
import { requireScope } from "~/server/households";
import { getUserCurrency } from "~/server/queries/settings";
import { getDocumentsForLease } from "~/server/queries/documents";
import {
  getLeaseForHousehold,
  hasPaymentsForLease,
} from "~/server/queries/leases";
import { getPropertyForHousehold } from "~/server/queries/properties";
import { getRoomsForProperty } from "~/server/queries/rentals";

export default async function EditLeasePage({
  params,
}: {
  params: Promise<{ id: string; leaseId: string }>;
}) {
  const { id, leaseId } = await params;
  const scope = await requireScope();

  const property = await getPropertyForHousehold(id, scope.householdId);
  if (!property) {
    notFound();
  }

  const lease = await getLeaseForHousehold(leaseId, scope.householdId);
  if (lease?.propertyId !== id) {
    notFound();
  }
  const symbol = currencySymbol(
    lease.currency ??
      property.currency ??
      (await getUserCurrency(scope.userId)),
  );

  const [rooms, canDelete, documents] = await Promise.all([
    getRoomsForProperty(id),
    hasPaymentsForLease(leaseId).then((hasBills) => !hasBills),
    getDocumentsForLease(leaseId, scope.householdId),
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

      <ActionForm
        action={updateLeaseForm.bind(null, lease.id)}
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
            <span className={labelClass}>Rent amount ({symbol}/month)</span>
            <input
              type="number"
              name="rentAmount"
              min="1"
              step="1"
              required
              defaultValue={fromMinorUnits(lease.rentAmount)}
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Deposit amount ({symbol})</span>
            <input
              type="number"
              name="depositAmount"
              min="0"
              step="1"
              required
              defaultValue={fromMinorUnits(lease.depositAmount)}
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
            <span className={labelClass}>Rent due day</span>
            <input
              type="number"
              name="rentDueDay"
              min="1"
              max="31"
              step="1"
              placeholder="e.g. 5"
              required
              defaultValue={lease.rentDueDay ?? lease.leaseStart.getUTCDate()}
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
      </ActionForm>

      <div className="max-w-3xl space-y-4 rounded-card border border-line bg-surface p-6">
        <div>
          <p className="text-sm font-semibold text-ink">End lease</p>
          <p className="mt-1 text-xs text-muted">
            {lease.active
              ? "Marks this lease inactive. The record is kept for history."
              : "This lease has already ended."}
          </p>
        </div>
        <ActionForm
          action={endLeaseForm.bind(null, lease.id)}
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
        </ActionForm>
      </div>

      <div className="max-w-3xl space-y-4 rounded-card border border-line bg-surface p-6">
        <div>
          <p className="text-sm font-semibold text-ink">Delete lease</p>
          <p className="mt-1 text-xs text-muted">
            {canDelete
              ? "Permanently removes this lease. Only possible while no rent has been received; unpaid rent is removed with it."
              : "Rent has been received on this lease, so it can't be deleted — end the lease instead."}
          </p>
        </div>
        <ActionForm
          action={deleteLeaseForm.bind(null, lease.id)}
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
        </ActionForm>
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
