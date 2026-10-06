import { notFound, redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { SubmitButton } from "~/app/_components/submit-button";
import { FormActions, controlClass, labelClass } from "~/app/_components/form";
import { PageHeader } from "~/app/_components/page-header";
import { toDateInputValue } from "~/lib/format";
import { LOAN_TYPE_LABELS } from "~/lib/labels";
import { deleteLoan, updateLoan } from "~/server/actions/loans";
import { getSession } from "~/server/better-auth/server";
import { getLoanForOwner, hasBillsForLoan } from "~/server/queries/loans";
import { getPropertyOptionsForOwner } from "~/server/queries/properties";

export default async function EditLoanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const loan = await getLoanForOwner(id, session.user.id);
  if (!loan) {
    notFound();
  }
  const properties = await getPropertyOptionsForOwner(session.user.id);
  const canDelete = !(await hasBillsForLoan(id));

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Loans", href: "/loans" },
          { label: loan.lender },
          { label: "Edit" },
        ]}
        title={`Edit ${loan.lender}`}
        description="Update this loan's terms and outstanding balance."
      />

      <form
        action={updateLoan.bind(null, loan.id)}
        data-gtm-event="loan_updated"
        className="max-w-3xl space-y-5 rounded-card border border-line bg-surface p-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Lender</span>
            <input
              type="text"
              name="lender"
              required
              defaultValue={loan.lender}
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Type</span>
            <select
              name="type"
              required
              defaultValue={loan.type}
              className={controlClass}
            >
              {Object.entries(LOAN_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Principal (₹)</span>
            <input
              type="number"
              name="principal"
              min="1"
              step="1"
              required
              defaultValue={loan.principal}
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Interest rate (% p.a.)</span>
            <input
              type="number"
              name="interestRatePercent"
              min="0"
              step="0.01"
              required
              defaultValue={loan.interestRatePercent}
              className={controlClass}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Tenure (months)</span>
            <input
              type="number"
              name="tenureMonths"
              min="1"
              step="1"
              required
              defaultValue={loan.tenureMonths}
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>EMI amount (₹)</span>
            <input
              type="number"
              name="emiAmount"
              min="1"
              step="1"
              required
              defaultValue={loan.emiAmount}
              className={controlClass}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>EMI due day (1-31)</span>
            <input
              type="number"
              name="emiDueDay"
              min="1"
              max="31"
              step="1"
              required
              defaultValue={loan.emiDueDay}
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Start date</span>
            <input
              type="date"
              name="startDate"
              required
              defaultValue={toDateInputValue(loan.startDate)}
              className={controlClass}
            />
          </label>
        </div>

        <label className="block">
          <span className={labelClass}>Outstanding balance (₹)</span>
          <input
            type="number"
            name="outstandingBalance"
            min="0"
            step="1"
            defaultValue={loan.outstandingBalance}
            className={`${controlClass} sm:w-56`}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Linked property (optional)</span>
          <select
            name="linkedPropertyId"
            defaultValue={loan.linkedPropertyId ?? ""}
            className={`${controlClass} sm:w-72`}
          >
            <option value="">Not linked to a property</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
          <span className="mt-1.5 block text-xs text-muted">
            Links this loan&apos;s EMI bills to a property, e.g. a home loan
            against a property you own.
          </span>
        </label>

        <FormActions>
          <Button href="/loans" variant="outline">
            Cancel
          </Button>
          <SubmitButton>Save changes</SubmitButton>
        </FormActions>
      </form>

      <div className="max-w-3xl space-y-4 rounded-card border border-line bg-surface p-6">
        <div>
          <p className="text-sm font-semibold text-ink">Delete loan</p>
          <p className="mt-1 text-xs text-muted">
            {canDelete
              ? "Permanently removes this loan and its EMI schedule. Only possible when it has no EMI payments on record."
              : "This loan has EMI payments on record, so it can't be deleted."}
          </p>
        </div>
        <form
          action={deleteLoan.bind(null, loan.id)}
          data-gtm-event="loan_deleted"
        >
          <SubmitButton
            variant="outline"
            color="red"
            disabled={!canDelete}
            title={canDelete ? undefined : "EMI payments exist for this loan"}
          >
            Delete loan
          </SubmitButton>
        </form>
      </div>
    </>
  );
}
