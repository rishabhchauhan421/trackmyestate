import { notFound } from "next/navigation";

import { ActionForm } from "~/app/_components/action-form";
import { Button } from "~/app/_components/button";
import { SubmitButton } from "~/app/_components/submit-button";
import { FormActions } from "~/app/_components/form";
import { PageHeader, propertyCrumbs } from "~/app/_components/page-header";
import {
  deletePropertyForm,
  updatePropertyForm,
} from "~/server/actions/properties";
import { requireScope } from "~/server/households";
import {
  getPropertyForHousehold,
  hasDependentRecordsForProperty,
} from "~/server/queries/properties";
import { PropertyFormFields } from "../../_components/property-form-fields";

export default async function EditPropertyPage({
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

  const hasDependents = await hasDependentRecordsForProperty(id);

  return (
    <>
      <PageHeader
        breadcrumbs={[...propertyCrumbs(property), { label: "Edit" }]}
        title="Edit property"
        description="Update this property's details — keep its current estimated value up to date for an accurate net worth."
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <ActionForm
          action={updatePropertyForm.bind(null, property.id)}
          data-gtm-event="property_updated"
          className="min-w-0 flex-1 space-y-4"
        >
          <PropertyFormFields property={property} />
          <FormActions>
            <Button href={`/properties/${id}`} variant="outline">
              Cancel
            </Button>
            <SubmitButton>Save changes</SubmitButton>
          </FormActions>
        </ActionForm>

        <aside className="space-y-3 rounded-card border border-danger/25 bg-surface p-5 lg:w-72">
          <h2 className="text-sm font-semibold text-ink">Delete property</h2>
          <p className="text-[0.8125rem] leading-relaxed text-muted">
            {hasDependents
              ? "This property has leases, rental units, utilities or bills on record, so it can't be deleted."
              : "Permanently removes this property. Only possible when it has no leases, rental units, utilities or bills on record."}
          </p>
          <ActionForm
            action={deletePropertyForm.bind(null, property.id)}
            data-gtm-event="property_deleted"
          >
            <SubmitButton
              variant="outline"
              color="red"
              size="sm"
              disabled={hasDependents}
              title={
                hasDependents
                  ? "Dependent records exist for this property"
                  : undefined
              }
            >
              Delete property
            </SubmitButton>
          </ActionForm>
        </aside>
      </div>
    </>
  );
}
