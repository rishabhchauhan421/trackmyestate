import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { PageHeader } from "~/app/_components/page-header";
import { LOAN_TYPE_LABELS } from "~/lib/labels";
import { createLoan } from "~/server/actions/loans";
import { getSession } from "~/server/better-auth/server";
import { getPropertyOptionsForOwner } from "~/server/queries/properties";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const labelClass = "text-xs font-medium text-slate-600 dark:text-slate-300";

export default async function NewLoanPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const properties = await getPropertyOptionsForOwner(session.user.id);

  return (
    <>
      <div>
        <Link
          href="/loans"
          className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          ← Loans
        </Link>
      </div>

      <PageHeader
        title="Add loan"
        description="Track a loan's principal, EMI and outstanding balance."
      />

      <form
        action={createLoan}
        data-gtm-event="loan_created"
        className="max-w-xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Lender</label>
            <input
              type="text"
              name="lender"
              required
              placeholder="e.g. HDFC Bank"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Type</label>
            <select
              name="type"
              required
              defaultValue="HOME_LOAN"
              className={inputClass}
            >
              {Object.entries(LOAN_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Principal (₹)</label>
            <input
              type="number"
              name="principal"
              min="1"
              step="1"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Interest rate (% p.a.)</label>
            <input
              type="number"
              name="interestRatePercent"
              min="0"
              step="0.01"
              required
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Tenure (months)</label>
            <input
              type="number"
              name="tenureMonths"
              min="1"
              step="1"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>EMI amount (₹)</label>
            <input
              type="number"
              name="emiAmount"
              min="1"
              step="1"
              required
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>EMI due day (1-31)</label>
            <input
              type="number"
              name="emiDueDay"
              min="1"
              max="31"
              step="1"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Start date</label>
            <input type="date" name="startDate" required className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Outstanding balance (₹, optional)</label>
          <input
            type="number"
            name="outstandingBalance"
            min="0"
            step="1"
            placeholder="Defaults to the principal"
            className={`${inputClass} sm:w-56`}
          />
        </div>

        <div>
          <label className={labelClass}>Linked property (optional)</label>
          <select
            name="linkedPropertyId"
            defaultValue=""
            className={`${inputClass} sm:w-72`}
          >
            <option value="">Not linked to a property</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Links this loan&apos;s EMI bills to a property, e.g. a home loan
            against a property you own.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit">Save loan</Button>
          <Link
            href="/loans"
            className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
