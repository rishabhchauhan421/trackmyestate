import { redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { FormActions, controlClass, labelClass } from "~/app/_components/form";
import { PageHeader } from "~/app/_components/page-header";
import { POLICY_TYPE_LABELS } from "~/lib/labels";
import { createPolicy } from "~/server/actions/policies";
import { getSession } from "~/server/better-auth/server";

export default async function NewPolicyPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Insurance", href: "/insurance" },
          { label: "Add policy" },
        ]}
        title="Add policy"
        description="Track a policy's premium due dates, sum assured, maturity payouts and claims."
      />

      <form
        action={createPolicy}
        data-gtm-event="policy_created"
        className="max-w-3xl space-y-5 rounded-card border border-line bg-surface p-6"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Insurer</span>
            <input
              type="text"
              name="insurer"
              required
              placeholder="e.g. LIC, HDFC Ergo"
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Type</span>
            <select
              name="type"
              required
              defaultValue="TERM_LIFE"
              className={controlClass}
            >
              {Object.entries(POLICY_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Policy number</span>
            <input
              type="text"
              name="policyNumber"
              required
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Policyholder name</span>
            <input
              type="text"
              name="holderName"
              required
              className={controlClass}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Start date</span>
            <input
              type="date"
              name="startDate"
              required
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Tenure (years, optional)</span>
            <input
              type="number"
              name="tenureYears"
              min="1"
              step="1"
              className={controlClass}
            />
          </label>
        </div>

        <label className="block">
          <span className={labelClass}>
            Nominees (comma-separated, optional)
          </span>
          <input
            type="text"
            name="nominees"
            placeholder="e.g. Jane Doe, John Doe"
            className={controlClass}
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Sum assured (₹, optional)</span>
            <input
              type="number"
              name="sumAssured"
              min="0"
              step="1"
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Room rent limit (₹, optional)</span>
            <input
              type="number"
              name="roomRentLimit"
              min="0"
              step="1"
              className={controlClass}
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>Co-pay % (optional)</span>
            <input
              type="number"
              name="coPayPercent"
              min="0"
              step="0.1"
              className={controlClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>
              Waiting period (months, optional)
            </span>
            <input
              type="number"
              name="waitingPeriodMonths"
              min="0"
              step="1"
              className={controlClass}
            />
          </label>
        </div>

        <FormActions>
          <Button href="/insurance" variant="outline">
            Cancel
          </Button>
          <Button type="submit">Save policy</Button>
        </FormActions>
      </form>
    </>
  );
}
