import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "~/app/_components/page-header";
import { StatusBadge } from "~/app/_components/status-badge";
import { formatDate, formatINR } from "~/lib/format";
import { BILL_TYPE_LABELS } from "~/lib/labels";
import { markBillPaid } from "~/server/actions/bills";
import { getSession } from "~/server/better-auth/server";
import { getUtilityBillForOwner } from "~/server/queries/utilities";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const labelClass = "text-xs font-medium text-slate-600 dark:text-slate-300";

export default async function UtilityBillPage({
  params,
}: {
  params: Promise<{ id: string; billId: string }>;
}) {
  const { id, billId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const bill = await getUtilityBillForOwner(billId, session.user.id);
  if (!bill || bill.propertyId !== id) {
    notFound();
  }

  const label = bill.utility.provider
    ? `${bill.utility.provider} · ${BILL_TYPE_LABELS[bill.utility.type]}`
    : BILL_TYPE_LABELS[bill.utility.type];

  const isOpen =
    bill.status === "DUE" ||
    bill.status === "OVERDUE" ||
    bill.status === "PARTIALLY_PAID";

  return (
    <>
      <div>
        <Link
          href={`/properties/${id}/utilities`}
          className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          ← {bill.property.name} utilities
        </Link>
      </div>

      <PageHeader
        title={label}
        description={`${formatINR(bill.amount)} · due ${formatDate(bill.dueDate)}`}
      />

      <div className="max-w-xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <p className={labelClass}>Status</p>
          <StatusBadge status={bill.status} />
        </div>

        {isOpen ? (
          <form
            action={markBillPaid.bind(null, bill.id)}
            data-gtm-event="bill_marked_paid"
            className="space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800"
          >
            <div>
              <label className={labelClass}>Paid on</label>
              <input
                type="date"
                name="paidOn"
                required
                className={`${inputClass} sm:w-56`}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
              >
                Mark paid
              </button>
              <Link
                href={`/properties/${id}/utilities`}
                className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Cancel
              </Link>
            </div>
          </form>
        ) : (
          <p className="border-t border-slate-100 pt-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
            Paid {bill.paidDate ? formatDate(bill.paidDate) : "—"}
            {bill.paidAmount != null && <> · {formatINR(bill.paidAmount)}</>}
          </p>
        )}
      </div>
    </>
  );
}
