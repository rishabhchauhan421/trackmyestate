import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { PageHeader } from "~/app/_components/page-header";
import { toDateInputValue } from "~/lib/format";
import { INVESTMENT_TYPE_LABELS } from "~/lib/labels";
import { deleteInvestment, updateInvestment } from "~/server/actions/investments";
import { getSession } from "~/server/better-auth/server";
import {
  getInvestmentForOwner,
  hasBillsForInvestment,
} from "~/server/queries/investments";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const labelClass = "text-xs font-medium text-slate-600 dark:text-slate-300";

export default async function EditInvestmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const investment = await getInvestmentForOwner(id, session.user.id);
  if (!investment) {
    notFound();
  }
  const canDelete = !(await hasBillsForInvestment(id));

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
        title={`Edit ${investment.name}`}
        description="Update this investment's details, including its current estimated value."
      />

      <form
        action={updateInvestment.bind(null, investment.id)}
        data-gtm-event="investment_updated"
        className="max-w-xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Name</label>
            <input
              type="text"
              name="name"
              required
              defaultValue={investment.name}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Type</label>
            <select
              name="type"
              required
              defaultValue={investment.type}
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
              defaultValue={investment.institution ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Invested date</label>
            <input
              type="date"
              name="investedDate"
              required
              defaultValue={toDateInputValue(investment.investedDate)}
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
              defaultValue={investment.capitalDeployed}
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
              defaultValue={investment.currentEstimatedValue ?? ""}
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
              defaultValue={investment.expectedReturnType ?? ""}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Expected return date (optional)</label>
            <input
              type="date"
              name="expectedReturnDate"
              defaultValue={
                investment.expectedReturnDate
                  ? toDateInputValue(investment.expectedReturnDate)
                  : ""
              }
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Target ROI % (optional)</label>
          <input
            type="number"
            name="targetRoiPercent"
            min="0"
            step="0.1"
            defaultValue={investment.targetRoiPercent ?? ""}
            className={`${inputClass} sm:w-40`}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit">Save changes</Button>
          <Link
            href="/investments"
            className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Cancel
          </Link>
        </div>
      </form>

      <div className="max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Delete investment
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {canDelete
              ? "Permanently removes this investment. Only possible when it has no bills on record."
              : "This investment has bills on record, so it can't be deleted."}
          </p>
        </div>
        <form
          action={deleteInvestment.bind(null, investment.id)}
          data-gtm-event="investment_deleted"
        >
          <Button
            type="submit"
            variant="outline"
            color="red"
            disabled={!canDelete}
            title={canDelete ? undefined : "Bills exist for this investment"}
          >
            Delete investment
          </Button>
        </form>
      </div>
    </>
  );
}
