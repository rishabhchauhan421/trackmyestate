import { notFound } from "next/navigation";

import { ActionForm } from "~/app/_components/action-form";
import { Button } from "~/app/_components/button";
import { Field, FormActions, FormSection, Input } from "~/app/_components/form";
import { PageHeader, propertyCrumbs } from "~/app/_components/page-header";
import { SubmitButton } from "~/app/_components/submit-button";
import { PropertyIssueType } from "../../../../../../../generated/prisma";
import { createIssueForm } from "~/server/actions/issues";
import { requireScope } from "~/server/households";
import { getPropertyForHousehold } from "~/server/queries/properties";
import { IssueFormFields } from "../../../_components/issue-form-fields";

export default async function NewIssuePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const [{ id }, { type }, scope] = await Promise.all([
    params,
    searchParams,
    requireScope(),
  ]);
  const property = await getPropertyForHousehold(id, scope.householdId);
  if (!property) notFound();
  // A link (e.g. the freehold check-in email) can preselect the type.
  const defaultType = type && type in PropertyIssueType ? type : undefined;

  return (
    <>
      <PageHeader
        breadcrumbs={[...propertyCrumbs(property), { label: "Add issue" }]}
        title="Add issue"
        description="Track a dispute, a pending conversion or unpaid dues on this property. You can add payments and more dates after saving."
      />

      <ActionForm
        action={createIssueForm}
        data-gtm-event="property_issue_created"
        className="max-w-3xl space-y-5"
      >
        <input type="hidden" name="propertyId" value={id} />
        <IssueFormFields defaultType={defaultType} />

        <FormSection
          title="First key date"
          optional
          description="A hearing, a deadline or an expected decision. We'll email you a week before, the day before and on the day."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="What it is">
              <Input name="keyDateLabel" placeholder="e.g. Next hearing" />
            </Field>
            <Field label="Date">
              <Input type="date" name="keyDate" />
            </Field>
          </div>
        </FormSection>

        <FormActions>
          <Button href={`/properties/${id}`} variant="outline">
            Cancel
          </Button>
          <SubmitButton>Save issue</SubmitButton>
        </FormActions>
      </ActionForm>
    </>
  );
}
