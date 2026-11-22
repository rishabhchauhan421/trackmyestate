import { notFound, redirect } from "next/navigation";

import { ActionForm } from "~/app/_components/action-form";
import { Button } from "~/app/_components/button";
import {
  ChoiceCards,
  Field,
  FormActions,
  FormSection,
  Input,
  controlClass,
} from "~/app/_components/form";
import { PageHeader, propertyCrumbs } from "~/app/_components/page-header";
import { SubmitButton } from "~/app/_components/submit-button";
import { formatMoney } from "~/lib/format";
import { todayInTimeZone } from "~/lib/time-zone";
import { closeIssueForm } from "~/server/actions/issues";
import { requireScope } from "~/server/households";
import { getIssueForHousehold } from "~/server/queries/issues";
import { getUserCurrency, getUserTimeZone } from "~/server/queries/settings";

export default async function ResolveIssuePage({
  params,
}: {
  params: Promise<{ id: string; issueId: string }>;
}) {
  const [{ id, issueId }, scope] = await Promise.all([params, requireScope()]);
  const [issue, timeZone, userCurrency] = await Promise.all([
    getIssueForHousehold(issueId, scope.householdId),
    getUserTimeZone(scope.userId),
    getUserCurrency(scope.userId),
  ]);
  if (issue?.propertyId !== id) notFound();
  const back = `/properties/${id}/issues/${issue.id}`;
  // Already closed (an old email link, say): nothing to do here.
  if (issue.status !== "OPEN") redirect(back);

  const unpaid = issue.bills.filter(
    (bill) => bill.status === "DUE" || bill.status === "OVERDUE",
  );
  const unpaidTotal = unpaid.reduce((sum, bill) => sum + bill.amount, 0);
  const currency = issue.property.currency ?? userCurrency;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          ...propertyCrumbs(issue.property),
          { label: issue.title, href: back },
          { label: "Close" },
        ]}
        title="Close this issue"
        description="Record how it ended. Its alerts stop, and it stays on the property as history."
      />

      <ActionForm
        action={closeIssueForm.bind(null, issue.id)}
        data-gtm-event="property_issue_closed"
        className="max-w-3xl space-y-5"
      >
        <FormSection title="Outcome">
          <ChoiceCards
            legend="How did it end?"
            name="result"
            defaultValue="RESOLVED"
            required
            options={[
              { value: "RESOLVED", label: "Resolved" },
              { value: "DROPPED", label: "Dropped (no longer applies)" },
            ]}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Closed on">
              <Input
                type="date"
                name="resolvedOn"
                defaultValue={todayInTimeZone(timeZone)}
              />
            </Field>
          </div>
          <Field
            label="What was decided"
            optional
            hint="e.g. the order, the settlement terms, the deed number."
          >
            <textarea name="outcome" rows={3} className={controlClass} />
          </Field>
        </FormSection>

        {(unpaid.length > 0 || issue.type === "FREEHOLD_CONVERSION") && (
          <FormSection title="Tidy up">
            {unpaid.length > 0 && (
              <label className="flex items-start gap-3 text-sm text-ink">
                <input
                  type="checkbox"
                  name="cancelUnpaid"
                  className="mt-0.5 size-4.5 rounded border-line-strong text-accent focus:ring-accent"
                />
                <span>
                  Remove the {unpaid.length} unpaid{" "}
                  {unpaid.length === 1 ? "payment" : "payments"} (
                  {formatMoney(unpaidTotal, currency)})
                  <span className="mt-0.5 block text-xs text-muted">
                    Leave unticked if they are still owed: they stay on the
                    property and keep reminding you.
                  </span>
                </span>
              </label>
            )}
            {issue.type === "FREEHOLD_CONVERSION" &&
              issue.property.ownershipType !== "FREEHOLD" && (
                <label className="flex items-start gap-3 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="markFreehold"
                    defaultChecked
                    className="mt-0.5 size-4.5 rounded border-line-strong text-accent focus:ring-accent"
                  />
                  <span>
                    Mark the property as freehold
                    <span className="mt-0.5 block text-xs text-muted">
                      Applies when the issue is resolved, and ends the freehold
                      check-ins.
                    </span>
                  </span>
                </label>
              )}
          </FormSection>
        )}

        <FormActions>
          <Button href={back} variant="outline">
            Cancel
          </Button>
          <SubmitButton>Close issue</SubmitButton>
        </FormActions>
      </ActionForm>
    </>
  );
}
