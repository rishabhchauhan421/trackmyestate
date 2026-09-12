import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { PageHeader } from "~/app/_components/page-header";
import { toDateInputValue } from "~/lib/format";
import { LOAN_TYPE_LABELS } from "~/lib/labels";
import { deleteLoan, updateLoan } from "~/server/actions/loans";
import { getSession } from "~/server/better-auth/server";
import { getLoanForOwner, hasBillsForLoan } from "~/server/queries/loans";
import { getPropertyOptionsForOwner } from "~/server/queries/properties";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const labelClass = "text-xs font-medium text-slate-600 dark:text-slate-300";

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
      <div>
        <Link
          href="/loans"
          className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          ← Loans
        </Link>
      </div>

      <PageHeader
        title={`Edit ${loan.lender}`}
        description="Update this loan's terms and outstanding balance."
      />

      <form
        action={updateLoan.bind(null, loan.id)}
        data-gtm-event="loan_updated"
        className="max-w-xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Lender</label>
            <input
              type="text"
              name="lender"
              required
              defaultValue={loan.lender}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Type</label>
            <select
              name="type"
              required
              defaultValue={loan.type}
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
              defaultValue={loan.principal}
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
              defaultValue={loan.interestRatePercent}
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
              defaultValue={loan.tenureMonths}
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
              defaultValue={loan.emiAmount}
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
              defaultValue={loan.emiDueDay}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Start date</label>
            <input
              type="date"
              name="startDate"
              required
              defaultValue={toDateInputValue(loan.startDate)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Outstanding balance (₹)</label>
          <input
            type="number"
            name="outstandingBalance"
            min="0"
            step="1"
            defaultValue={loan.outstandingBalance}
            className={`${inputClass} sm:w-56`}
          />
        </div>

        <div>
          <label className={labelClass}>Linked property (optional)</label>
          <select
            name="linkedPropertyId"
            defaultValue={loan.linkedPropertyId ?? ""}
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
          <Button type="submit">Save changes</Button>
          <Link
            href="/loans"
            className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Cancel
          </Link>
        </div>
      </form>

      <div className="max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Delete loan
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {canDelete
              ? "Permanently removes this loan and its EMI schedule. Only possible when it has no EMI payments on record."
              : "This loan has EMI payments on record, so it can't be deleted."}
          </p>
        </div>
        <form
          action={deleteLoan.bind(null, loan.id)}
          data-gtm-event="loan_deleted"
        >
          <Button
            type="submit"
            variant="outline"
            color="red"
            disabled={!canDelete}
            title={canDelete ? undefined : "EMI payments exist for this loan"}
          >
            Delete loan
          </Button>
        </form>
      </div>
    </>
  );
}
