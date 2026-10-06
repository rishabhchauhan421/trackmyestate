import { notFound, redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { SubmitButton } from "~/app/_components/submit-button";
import { FormActions, controlClass, labelClass } from "~/app/_components/form";
import { PageHeader, propertyCrumbs } from "~/app/_components/page-header";
import { BILL_TYPE_LABELS, UTILITY_RECURRENCE_LABELS } from "~/lib/labels";
import { todayInTimeZone } from "~/lib/time-zone";
import { createUtility } from "~/server/actions/utilities";
import { getSession } from "~/server/better-auth/server";
import { getPropertyForOwner } from "~/server/queries/properties";
import { getUserTimeZone } from "~/server/queries/settings";
import { BillingFields } from "./billing-fields";

export default async function NewUtilityPage({
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
  const timeZone = await getUserTimeZone(session.user.id);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          ...propertyCrumbs(property, "Utilities"),
          { label: "Add utility" },
        ]}
        title="Add utility"
        description="Set up a recurring bill schedule for this property. Bills are generated automatically, on the date of each cycle's first reminder — you can add who to notify afterwards."
      />

      <form
        action={createUtility}
        data-gtm-event="utility_created"
        className="max-w-3xl space-y-5 rounded-card border border-line bg-surface p-6"
      >
        <input type="hidden" name="propertyId" value={id} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Type</span>
            <select
              name="type"
              required
              defaultValue="ELECTRICITY"
              className={controlClass}
            >
              {Object.entries(BILL_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Recurrence</span>
            <select
              name="recurrence"
              required
              defaultValue="MONTHLY"
              className={controlClass}
            >
              {Object.entries(UTILITY_RECURRENCE_LABELS).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Provider (optional)</span>
            <input
              type="text"
              name="provider"
              placeholder="e.g. BESCOM"
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Account number (optional)</span>
            <input type="text" name="accountNumber" className={controlClass} />
          </label>
        </div>

        <BillingFields />

        <label className="block">
          <span className={labelClass}>First due date</span>
          <input
            type="date"
            name="firstDueDate"
            required
            min={todayInTimeZone(timeZone)}
            className={`${controlClass} sm:w-56`}
          />
          <span className="mt-1.5 block text-xs text-muted">
            Today or later. Sets the recurring due day (and month, for yearly
            bills) — doesn&apos;t create a bill itself.
          </span>
        </label>

        <FormActions>
          <Button href={`/properties/${id}/utilities`} variant="outline">
            Cancel
          </Button>
          <SubmitButton>Save utility</SubmitButton>
        </FormActions>
      </form>
    </>
  );
}
