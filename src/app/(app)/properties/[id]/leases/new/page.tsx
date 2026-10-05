import { notFound, redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { FormActions, controlClass, labelClass } from "~/app/_components/form";
import { PageHeader, propertyCrumbs } from "~/app/_components/page-header";
import { createLease } from "~/server/actions/leases";
import { getSession } from "~/server/better-auth/server";
import { getPropertyForOwner } from "~/server/queries/properties";
import { getRoomsForProperty } from "~/server/queries/rentals";

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
    redirect(`/properties/${id}/leases`);
  }

  const rooms = await getRoomsForProperty(id);
  const preselectedRoomId = typeof roomId === "string" ? roomId : "";

  return (
    <>
      <PageHeader
        breadcrumbs={[
          ...propertyCrumbs(property, "Leases"),
          { label: "Add lease" },
        ]}
        title="Add lease"
        description="Start a new lease for this property — the whole property, or one of its rental units."
      />

      <form
        action={createLease}
        data-gtm-event="lease_created"
        className="max-w-3xl space-y-5 rounded-card border border-line bg-surface p-6"
      >
        <input type="hidden" name="propertyId" value={id} />

        {rooms.length > 0 && (
          <label className="block">
            <span className={labelClass}>Rental unit</span>
            <select
              name="roomId"
              defaultValue={preselectedRoomId}
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
            <span className={labelClass}>Tenant name</span>
            <input
              type="text"
              name="tenantName"
              required
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Tenant phone</span>
            <input
              type="tel"
              name="tenantPhone"
              required
              className={controlClass}
            />
          </label>
        </div>

        <label className="block">
          <span className={labelClass}>Tenant email (optional)</span>
          <input type="email" name="tenantEmail" className={controlClass} />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Lease start</span>
            <input
              type="date"
              name="leaseStart"
              required
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Lease end (optional)</span>
            <input type="date" name="leaseEnd" className={controlClass} />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Rent amount (₹/month)</span>
            <input
              type="number"
              name="rentAmount"
              min="1"
              step="1"
              required
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
              className={controlClass}
            />
          </label>
        </div>

        <label className="block">
          <span className={labelClass}>Rent due day (optional)</span>
          <input
            type="number"
            name="rentDueDay"
            min="1"
            max="31"
            step="1"
            placeholder="e.g. 5"
            className={`${controlClass} sm:w-40`}
          />
          <span className="mt-1.5 block text-xs text-muted">
            Day of the month rent is due — for display only.
          </span>
        </label>

        <FormActions>
          <Button href={`/properties/${id}/leases`} variant="outline">
            Cancel
          </Button>
          <Button type="submit">Save lease</Button>
        </FormActions>
      </form>
    </>
  );
}
