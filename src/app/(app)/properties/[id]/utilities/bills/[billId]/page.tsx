import Link from "next/link";
import { SubmitButton } from "~/app/_components/submit-button";
import { notFound, redirect } from "next/navigation";

import { controlClass, labelClass } from "~/app/_components/form";
import { PageHeader, propertyCrumbs } from "~/app/_components/page-header";
import { StatusBadge } from "~/app/_components/status-badge";
import { formatBillAmount, formatDate, formatINR } from "~/lib/format";
import { BILL_TYPE_LABELS } from "~/lib/labels";
import { markBillPaid } from "~/server/actions/bills";
import { getSession } from "~/server/better-auth/server";
import { getUtilityBillForOwner } from "~/server/queries/utilities";

export default async function UtilityBillPage({
  params,
}: {
  params: Promise<{ id: string; billId: string }>;
}) {
  const { id, billId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const bill = await getUtilityBillForOwner(billId, session.user.id);
  if (bill?.propertyId !== id) {
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
      <PageHeader
        breadcrumbs={[
          ...propertyCrumbs({ id, name: bill.property.name }, "Utilities"),
          { label },
        ]}
        title={label}
        description={`${formatBillAmount(
          bill.amount,
          bill.utility.billingType === "VARIABLE" && bill.status !== "PAID",
        )} · due ${formatDate(bill.dueDate)}`}
      />

      <div className="max-w-3xl space-y-5 rounded-card border border-line bg-surface p-6">
        <div className="flex items-center justify-between">
          <p className={labelClass}>Status</p>
          <StatusBadge status={bill.status} />
        </div>

        {isOpen ? (
          <form
            action={markBillPaid.bind(null, bill.id)}
            data-gtm-event="bill_marked_paid"
            className="space-y-4 border-t border-line-soft pt-4"
          >
            <label className="block">
              <span className={labelClass}>Paid on</span>
              <input
                type="date"
                name="paidOn"
                required
                className={`${controlClass} sm:w-56`}
              />
            </label>
            <div className="flex items-center gap-3">
              <SubmitButton color="slate" pendingLabel="Saving…">
                Mark paid
              </SubmitButton>
              <Link
                href={`/properties/${id}/utilities`}
                className="text-sm font-medium text-muted hover:text-ink"
              >
                Cancel
              </Link>
            </div>
          </form>
        ) : (
          <p className="border-t border-line-soft pt-4 text-sm text-ink-2">
            Paid {bill.paidDate ? formatDate(bill.paidDate) : "—"}
            {bill.paidAmount != null && <> · {formatINR(bill.paidAmount)}</>}
          </p>
        )}
      </div>
    </>
  );
}
