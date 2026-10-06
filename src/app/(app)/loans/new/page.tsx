import { redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { SubmitButton } from "~/app/_components/submit-button";
import { FormActions, controlClass, labelClass } from "~/app/_components/form";
import { PageHeader } from "~/app/_components/page-header";
import { LOAN_TYPE_LABELS } from "~/lib/labels";
import { createLoan } from "~/server/actions/loans";
import { getSession } from "~/server/better-auth/server";
import { getPropertyOptionsForOwner } from "~/server/queries/properties";

export default async function NewLoanPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const properties = await getPropertyOptionsForOwner(session.user.id);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Loans", href: "/loans" },
          { label: "Add loan" },
        ]}
        title="Add loan"
        description="Track a loan's principal, EMI and outstanding balance."
      />

      <form
        action={createLoan}
        data-gtm-event="loan_created"
        className="max-w-3xl space-y-5 rounded-card border border-line bg-surface p-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Lender</span>
            <input
              type="text"
              name="lender"
              required
              placeholder="e.g. HDFC Bank"
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Type</span>
            <select
              name="type"
              required
              defaultValue="HOME_LOAN"
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
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Start date</span>
            <input
              type="date"
              name="startDate"
              required
              className={controlClass}
            />
          </label>
        </div>

        <label className="block">
          <span className={labelClass}>Outstanding balance (₹, optional)</span>
          <input
            type="number"
            name="outstandingBalance"
            min="0"
            step="1"
            placeholder="Defaults to the principal"
            className={`${controlClass} sm:w-56`}
          />
        </label>

        <label className="block">
          <span className={labelClass}>Linked property (optional)</span>
          <select
            name="linkedPropertyId"
            defaultValue=""
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
          <SubmitButton>Save loan</SubmitButton>
        </FormActions>
      </form>
    </>
  );
}
