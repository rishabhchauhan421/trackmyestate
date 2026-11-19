import { notFound } from "next/navigation";

import { ActionForm } from "~/app/_components/action-form";
import { Button } from "~/app/_components/button";
import { SubmitButton } from "~/app/_components/submit-button";
import { FormActions, controlClass, labelClass } from "~/app/_components/form";
import { PageHeader } from "~/app/_components/page-header";
import { toDateInputValue } from "~/lib/format";
import { INVESTMENT_TYPE_LABELS } from "~/lib/labels";
import { fromMinorUnits, optionalFromMinorUnits } from "~/lib/money";
import {
  deleteInvestmentForm,
  updateInvestmentForm,
} from "~/server/actions/investments";
import { requireScope } from "~/server/households";
import {
  getInvestmentForHousehold,
  hasPaymentsForInvestment,
} from "~/server/queries/investments";

export default async function EditInvestmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scope = await requireScope();

  const investment = await getInvestmentForHousehold(id, scope.householdId);
  if (!investment) {
    notFound();
  }
  const canDelete = !(await hasPaymentsForInvestment(id));

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Investments", href: "/investments" },
          { label: investment.name },
          { label: "Edit" },
        ]}
        title={`Edit ${investment.name}`}
        description="Update this investment's details, including its current estimated value."
      />

      <ActionForm
        action={updateInvestmentForm.bind(null, investment.id)}
        data-gtm-event="investment_updated"
        className="max-w-3xl space-y-5 rounded-card border border-line bg-surface p-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Name</span>
            <input
              type="text"
              name="name"
              required
              defaultValue={investment.name}
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Type</span>
            <select
              name="type"
              required
              defaultValue={investment.type}
              className={controlClass}
            >
              {Object.entries(INVESTMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Institution (optional)</span>
            <input
              type="text"
              name="institution"
              defaultValue={investment.institution ?? ""}
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Invested date</span>
            <input
              type="date"
              name="investedDate"
              required
              defaultValue={toDateInputValue(investment.investedDate)}
              className={controlClass}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Capital deployed (₹)</span>
            <input
              type="number"
              name="capitalDeployed"
              min="1"
              step="1"
              required
              defaultValue={fromMinorUnits(investment.capitalDeployed)}
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>
              Current estimated value (₹, optional)
            </span>
            <input
              type="number"
              name="currentEstimatedValue"
              min="0"
              step="1"
              defaultValue={
                optionalFromMinorUnits(investment.currentEstimatedValue) ?? ""
              }
              className={controlClass}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Expected return type (optional)</span>
            <input
              type="text"
              name="expectedReturnType"
              defaultValue={investment.expectedReturnType ?? ""}
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Expected return date (optional)</span>
            <input
              type="date"
              name="expectedReturnDate"
              defaultValue={
                investment.expectedReturnDate
                  ? toDateInputValue(investment.expectedReturnDate)
                  : ""
              }
              className={controlClass}
            />
          </label>
        </div>

        <label className="block">
          <span className={labelClass}>Target ROI % (optional)</span>
          <input
            type="number"
            name="targetRoiPercent"
            min="0"
            step="0.1"
            defaultValue={investment.targetRoiPercent ?? ""}
            className={`${controlClass} sm:w-40`}
          />
        </label>

        <FormActions>
          <Button href="/investments" variant="outline">
            Cancel
          </Button>
          <SubmitButton>Save changes</SubmitButton>
        </FormActions>
      </ActionForm>

      <div className="max-w-3xl space-y-4 rounded-card border border-line bg-surface p-6">
        <div>
          <p className="text-sm font-semibold text-ink">Delete investment</p>
          <p className="mt-1 text-xs text-muted">
            {canDelete
              ? "Permanently removes this investment. Only possible while nothing has been received on it; unpaid returns are removed with it."
              : "Returns have been received on this investment, so it can't be deleted."}
          </p>
        </div>
        <ActionForm
          action={deleteInvestmentForm.bind(null, investment.id)}
          data-gtm-event="investment_deleted"
        >
          <SubmitButton
            variant="outline"
            color="red"
            disabled={!canDelete}
            title={canDelete ? undefined : "Bills exist for this investment"}
          >
            Delete investment
          </SubmitButton>
        </ActionForm>
      </div>
    </>
  );
}
