import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ActionForm } from "~/app/_components/action-form";
import { Button } from "~/app/_components/button";
import { Card, CardHeader } from "~/app/_components/card";
import {
  Field,
  FormActions,
  FormSection,
  Input,
  MoneyInput,
  Notice,
  Select,
} from "~/app/_components/form";
import { PageHeader, type Crumb } from "~/app/_components/page-header";
import { StatusBadge } from "~/app/_components/status-badge";
import { SubmitButton } from "~/app/_components/submit-button";
import { billAsset, billTitle } from "~/lib/bill-context";
import { formatBillAmount, formatDate, formatINR } from "~/lib/format";
import { PAYMENT_METHOD_LABELS } from "~/lib/labels";
import { fromMinorUnits } from "~/lib/money";
import { todayInTimeZone } from "~/lib/time-zone";
import { recordBillPaymentForm } from "~/server/actions/bills";
import { requireScope } from "~/server/households";
import { getBillForHousehold } from "~/server/queries/bills";
import { getUserTimeZone } from "~/server/queries/settings";
import { OPEN_PAYMENT_STATUSES } from "~/server/queries/shared";

export default async function BillPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ id }, { saved }, scope] = await Promise.all([
    params,
    searchParams,
    requireScope(),
  ]);
  const [bill, timeZone] = await Promise.all([
    getBillForHousehold(id, scope.householdId),
    getUserTimeZone(scope.userId),
  ]);
  if (!bill) notFound();

  const title = billTitle(bill);
  const asset = billAsset(bill);
  const inflow = bill.direction === "INFLOW";
  const open = (OPEN_PAYMENT_STATUSES as readonly string[]).includes(
    bill.status,
  );
  const paidSoFar =
    bill.status === "PARTIALLY_PAID" ? (bill.paidAmount ?? 0) : 0;
  const outstanding = Math.max(bill.amount - paidSoFar, 0);
  const approx = open && bill.billSchedule?.billingType === "VARIABLE";

  const breadcrumbs: Crumb[] = [
    asset
      ? { label: asset.label, href: asset.href }
      : { label: "Timeline", href: "/timeline" },
    { label: title },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={title}
        description={`${formatBillAmount(bill.amount, approx)} · ${
          inflow ? "expected" : "due"
        } ${formatDate(bill.dueDate)}`}
      />

      {saved && (
        <Notice tone="success">
          {inflow ? "Receipt recorded." : "Payment recorded."}
        </Notice>
      )}

      <div className="grid max-w-5xl grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {open ? (
            <ActionForm
              action={recordBillPaymentForm.bind(null, bill.id)}
              data-gtm-event="bill_payment_recorded"
              className="space-y-4"
            >
              <FormSection
                title={inflow ? "Record money received" : "Record a payment"}
                description={
                  paidSoFar > 0
                    ? `${formatINR(paidSoFar)} recorded so far, ${formatINR(outstanding)} left.`
                    : undefined
                }
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label={inflow ? "Received on" : "Paid on"}>
                    <Input
                      type="date"
                      name="paidOn"
                      required
                      defaultValue={todayInTimeZone(timeZone)}
                    />
                  </Field>
                  <Field label="Amount">
                    <MoneyInput
                      name="amount"
                      required
                      defaultValue={fromMinorUnits(outstanding)}
                    />
                  </Field>
                  <Field label="Method">
                    <Select name="method" defaultValue="UPI" required>
                      {Object.entries(PAYMENT_METHOD_LABELS).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </Select>
                  </Field>
                  <Field label="Reference" optional>
                    <Input name="reference" placeholder="UTR or cheque no." />
                  </Field>
                </div>
                <label className="flex items-start gap-3 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="settles"
                    defaultChecked
                    className="mt-0.5 size-4 rounded border-line-strong text-accent focus:ring-accent/20"
                  />
                  <span>
                    This settles the {inflow ? "amount" : "bill"}
                    <span className="block text-xs text-muted">
                      Untick for a part payment; the rest stays open.
                    </span>
                  </span>
                </label>
              </FormSection>
              <FormActions>
                {asset && (
                  <Button href={asset.href} variant="outline">
                    Cancel
                  </Button>
                )}
                <SubmitButton pendingLabel="Saving…">
                  {inflow ? "Mark received" : "Mark paid"}
                </SubmitButton>
              </FormActions>
            </ActionForm>
          ) : (
            <Card className="p-5 text-sm text-ink-2 sm:p-6">
              {bill.status === "PAID"
                ? `${inflow ? "Received" : "Paid"} ${
                    bill.paidDate ? formatDate(bill.paidDate) : ""
                  }${bill.paidAmount != null ? ` · ${formatINR(bill.paidAmount)}` : ""}`
                : "This bill is closed."}
            </Card>
          )}

          <Card aria-labelledby="payments">
            <CardHeader title={<span id="payments">Payments</span>} />
            {bill.transactions.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted sm:px-6">
                Nothing recorded yet.
              </p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {bill.transactions.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3.5 text-sm sm:px-6"
                  >
                    <span className="text-ink">
                      {formatDate(payment.paidAt)}
                      <span className="text-muted">
                        {" "}
                        · {PAYMENT_METHOD_LABELS[payment.paymentMethod]}
                        {payment.referenceNumber &&
                          ` · ${payment.referenceNumber}`}
                      </span>
                    </span>
                    <span className="font-semibold text-ink">
                      {formatINR(payment.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card aria-labelledby="details" className="space-y-3 p-5 sm:p-6">
          <h2 id="details" className="text-base font-semibold text-ink">
            Details
          </h2>
          <dl className="space-y-2.5 text-[0.8125rem]">
            <DetailRow label="Status">
              <StatusBadge status={bill.status} />
            </DetailRow>
            <DetailRow label={inflow ? "Expected" : "Amount due"}>
              {formatBillAmount(bill.amount, approx)}
            </DetailRow>
            <DetailRow label="Due">{formatDate(bill.dueDate)}</DetailRow>
            {bill.installmentNumber != null && (
              <DetailRow label="Instalment">
                #{bill.installmentNumber}
              </DetailRow>
            )}
            {asset && <DetailRow label="For">{asset.label}</DetailRow>}
          </dl>
        </Card>
      </div>
    </>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{children}</dd>
    </div>
  );
}
