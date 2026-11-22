import { notFound } from "next/navigation";

import { ActionForm } from "~/app/_components/action-form";
import { Button } from "~/app/_components/button";
import { FormActions } from "~/app/_components/form";
import { PageHeader, propertyCrumbs } from "~/app/_components/page-header";
import { SubmitButton } from "~/app/_components/submit-button";
import { currencySymbol } from "~/lib/format";
import { addDuesForm } from "~/server/actions/issues";
import { requireScope } from "~/server/households";
import { getIssueForHousehold } from "~/server/queries/issues";
import { getPropertyForHousehold } from "~/server/queries/properties";
import { getUserCurrency } from "~/server/queries/settings";
import { DuesFormFields } from "./dues-form-fields";

export default async function NewDuePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ issueId?: string }>;
}) {
  const [{ id }, { issueId }, scope] = await Promise.all([
    params,
    searchParams,
    requireScope(),
  ]);
  const [property, issue] = await Promise.all([
    getPropertyForHousehold(id, scope.householdId),
    issueId ? getIssueForHousehold(issueId, scope.householdId) : null,
  ]);
  if (!property) notFound();
  // A payment can only go under one of this property's open issues.
  if (issueId && (issue?.propertyId !== id || issue.status !== "OPEN")) {
    notFound();
  }
  const symbol = currencySymbol(
    property.currency ?? (await getUserCurrency(scope.userId)),
  );
  const back = issue
    ? `/properties/${id}/issues/${issue.id}`
    : `/properties/${id}`;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          ...propertyCrumbs(property),
          ...(issue ? [{ label: issue.title, href: back }] : []),
          { label: "Add payment" },
        ]}
        title="Add payment"
        description={
          issue
            ? `A payment still to come under "${issue.title}". You'll be reminded before it's due.`
            : "A payment still to come on this property: an instalment, a charge, a settlement. You'll be reminded before it's due."
        }
      />

      <ActionForm
        action={addDuesForm}
        data-gtm-event="property_due_created"
        className="max-w-3xl space-y-5"
      >
        <input type="hidden" name="propertyId" value={id} />
        {issue && <input type="hidden" name="issueId" value={issue.id} />}
        <DuesFormFields symbol={symbol} />
        <FormActions>
          <Button href={back} variant="outline">
            Cancel
          </Button>
          <SubmitButton>Save</SubmitButton>
        </FormActions>
      </ActionForm>
    </>
  );
}
