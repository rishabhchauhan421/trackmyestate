import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "~/app/_components/page-header";
import { INVESTMENT_TYPE_LABELS } from "~/lib/labels";
import { createInvestment } from "~/server/actions/investments";
import { getSession } from "~/server/better-auth/server";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const labelClass = "text-xs font-medium text-slate-600 dark:text-slate-300";

export default async function NewInvestmentPage() {
  const session = await getSession();
  if (!session) redirect("/");

  return (
    <>
      <div>
        <Link
          href="/investments"
          className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          ← Investments
        </Link>
      </div>

      <PageHeader
        title="Add investment"
        description="Log a new investment to track its capital deployed and current value over time."
      />

      <form
        action={createInvestment}
        className="max-w-xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Name</label>
            <input
              type="text"
              name="name"
              required
              placeholder="e.g. HDFC Flexicap Fund"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Type</label>
            <select
              name="type"
              required
              defaultValue="MUTUAL_FUND"
              className={inputClass}
            >
              {Object.entries(INVESTMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Institution (optional)</label>
            <input
              type="text"
              name="institution"
              placeholder="e.g. HDFC Mutual Fund"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Invested date</label>
            <input
              type="date"
              name="investedDate"
              required
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Capital deployed (₹)</label>
            <input
              type="number"
              name="capitalDeployed"
              min="1"
              step="1"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Current estimated value (₹, optional)</label>
            <input
              type="number"
              name="currentEstimatedValue"
              min="0"
              step="1"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Expected return type (optional)</label>
            <input
              type="text"
              name="expectedReturnType"
              placeholder="e.g. Dividend, Maturity"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Expected return date (optional)</label>
            <input type="date" name="expectedReturnDate" className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Target ROI % (optional)</label>
          <input
            type="number"
            name="targetRoiPercent"
            min="0"
            step="0.1"
            className={`${inputClass} sm:w-40`}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
          >
            Save investment
          </button>
          <Link
            href="/investments"
            className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
