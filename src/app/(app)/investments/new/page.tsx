import { redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { FormActions, controlClass, labelClass } from "~/app/_components/form";
import { PageHeader } from "~/app/_components/page-header";
import { INVESTMENT_TYPE_LABELS } from "~/lib/labels";
import { createInvestment } from "~/server/actions/investments";
import { getSession } from "~/server/better-auth/server";

export default async function NewInvestmentPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Investments", href: "/investments" },
          { label: "Add investment" },
        ]}
        title="Add investment"
        description="Log a new investment to track its capital deployed and current value over time."
      />

      <form
        action={createInvestment}
        data-gtm-event="investment_created"
        className="max-w-3xl space-y-5 rounded-card border border-line bg-surface p-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Name</span>
            <input
              type="text"
              name="name"
              required
              placeholder="e.g. HDFC Flexicap Fund"
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Type</span>
            <select
              name="type"
              required
              defaultValue="MUTUAL_FUND"
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
              placeholder="e.g. HDFC Mutual Fund"
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Invested date</span>
            <input
              type="date"
              name="investedDate"
              required
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
              placeholder="e.g. Dividend, Maturity"
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Expected return date (optional)</span>
            <input
              type="date"
              name="expectedReturnDate"
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
            className={`${controlClass} sm:w-40`}
          />
        </label>

        <FormActions>
          <Button href="/investments" variant="outline">
            Cancel
          </Button>
          <Button type="submit">Save investment</Button>
        </FormActions>
      </form>
    </>
  );
}
