import { notFound } from "next/navigation";

import { ActionForm } from "~/app/_components/action-form";
import { Button } from "~/app/_components/button";
import { FormActions, FormSection } from "~/app/_components/form";
import { PageHeader, propertyCrumbs } from "~/app/_components/page-header";
import { SubmitButton } from "~/app/_components/submit-button";
import { deleteIssue, updateIssueForm } from "~/server/actions/issues";
import { requireScope } from "~/server/households";
import { getIssueForHousehold } from "~/server/queries/issues";
import { IssueFormFields } from "../../../../_components/issue-form-fields";

export default async function EditIssuePage({
  params,
}: {
  params: Promise<{ id: string; issueId: string }>;
}) {
  const [{ id, issueId }, scope] = await Promise.all([params, requireScope()]);
  const issue = await getIssueForHousehold(issueId, scope.householdId);
  if (issue?.propertyId !== id) notFound();
  const back = `/properties/${id}/issues/${issue.id}`;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          ...propertyCrumbs(issue.property),
          { label: issue.title, href: back },
          { label: "Edit" },
        ]}
        title="Edit issue"
        description="Change what this issue is about. Dates, payments and notes are managed on the issue's page."
      />

      <div className="max-w-3xl space-y-5">
        <ActionForm
          action={updateIssueForm.bind(null, issue.id)}
          className="space-y-5"
        >
          <IssueFormFields issue={issue} />
          <FormActions>
            <Button href={back} variant="outline">
              Cancel
            </Button>
            <SubmitButton>Save changes</SubmitButton>
          </FormActions>
        </ActionForm>

        <FormSection
          title="Delete this issue"
          description="For an issue added by mistake. Its unpaid payments are removed with it; payments already made stay on the property. To close an issue that's settled, mark it resolved instead."
        >
          <form action={deleteIssue.bind(null, issue.id)}>
            <SubmitButton variant="outline" color="red">
              Delete issue
            </SubmitButton>
          </form>
        </FormSection>
      </div>
    </>
  );
}
