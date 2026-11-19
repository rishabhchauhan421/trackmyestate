import { notFound, redirect } from "next/navigation";

import { ActionForm } from "~/app/_components/action-form";
import { Button } from "~/app/_components/button";
import { SubmitButton } from "~/app/_components/submit-button";
import { FormActions, controlClass, labelClass } from "~/app/_components/form";
import { PageHeader, propertyCrumbs } from "~/app/_components/page-header";
import { createRentalForm } from "~/server/actions/rentals";
import { requireScope } from "~/server/households";
import { getPropertyForHousehold } from "~/server/queries/properties";

export default async function NewRentalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scope = await requireScope();
  const property = await getPropertyForHousehold(id, scope.householdId);
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
      <PageHeader
        breadcrumbs={[
          ...propertyCrumbs(property, "Rental units"),
          { label: "Add rental unit" },
        ]}
        title="Add rental unit"
        description="A room, floor or unit within this property that gets rented out on its own. Create a lease for it afterwards."
      />

      <ActionForm
        action={createRentalForm}
        data-gtm-event="rental_created"
        className="max-w-3xl space-y-5 rounded-card border border-line bg-surface p-6"
      >
        <input type="hidden" name="propertyId" value={id} />

        <label className="block">
          <span className={labelClass}>Label</span>
          <input
            type="text"
            name="label"
            required
            placeholder="e.g. 2nd floor, Room B"
            className={controlClass}
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Floor (optional)</span>
            <input type="text" name="floor" className={controlClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Area (sqft, optional)</span>
            <input
              type="number"
              name="areaSqft"
              min="1"
              step="1"
              className={controlClass}
            />
          </label>
        </div>

        <FormActions>
          <Button href={`/properties/${id}/rentals`} variant="outline">
            Cancel
          </Button>
          <SubmitButton>Save rental unit</SubmitButton>
        </FormActions>
      </ActionForm>
    </>
  );
}
