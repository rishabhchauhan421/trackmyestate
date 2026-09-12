import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { PageHeader } from "~/app/_components/page-header";
import { POLICY_TYPE_LABELS } from "~/lib/labels";
import { createPolicy } from "~/server/actions/policies";
import { getSession } from "~/server/better-auth/server";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const labelClass = "text-xs font-medium text-slate-600 dark:text-slate-300";

export default async function NewPolicyPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <>
      <div>
        <Link
          href="/insurance"
          className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          ← Insurance
        </Link>
      </div>

      <PageHeader
        title="Add policy"
        description="Track a policy's premium due dates, sum assured, maturity payouts and claims."
      />

      <form
        action={createPolicy}
        data-gtm-event="policy_created"
        className="max-w-xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Insurer</label>
            <input
              type="text"
              name="insurer"
              required
              placeholder="e.g. LIC, HDFC Ergo"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Type</label>
            <select
              name="type"
              required
              defaultValue="TERM_LIFE"
              className={inputClass}
            >
              {Object.entries(POLICY_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Policy number</label>
            <input
              type="text"
              name="policyNumber"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Policyholder name</label>
            <input
              type="text"
              name="holderName"
              required
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Start date</label>
            <input
              type="date"
              name="startDate"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Tenure (years, optional)</label>
            <input
              type="number"
              name="tenureYears"
              min="1"
              step="1"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Nominees (comma-separated, optional)</label>
          <input
            type="text"
            name="nominees"
            placeholder="e.g. Jane Doe, John Doe"
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Sum assured (₹, optional)</label>
            <input
              type="number"
              name="sumAssured"
              min="0"
              step="1"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Room rent limit (₹, optional)</label>
            <input
              type="number"
              name="roomRentLimit"
              min="0"
              step="1"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Co-pay % (optional)</label>
            <input
              type="number"
              name="coPayPercent"
              min="0"
              step="0.1"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Waiting period (months, optional)</label>
            <input
              type="number"
              name="waitingPeriodMonths"
              min="0"
              step="1"
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit">Save policy</Button>
          <Link
            href="/insurance"
            className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
