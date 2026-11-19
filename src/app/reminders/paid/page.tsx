import { Suspense } from "react";
import { type Metadata } from "next";

import { Button } from "~/app/_components/button";
import { Field, Notice, Select } from "~/app/_components/form";
import { SlimLayout } from "~/app/_components/slim-layout";
import { SlimLayoutSkeleton } from "~/app/_components/skeleton";
import { SubmitButton } from "~/app/_components/submit-button";
import { formatDate, formatMoney } from "~/lib/format";
import { EVENT_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from "~/lib/labels";
import { markBillPaidFromLink } from "~/server/actions/bill-paid-link";
import { verifyBillPaid } from "~/server/bills/paid-link";
import { isOpenBill, outstandingAmount } from "~/server/bills/pay";
import { db } from "~/server/db";

export const metadata: Metadata = {
  title: "Mark as paid",
  robots: { index: false, follow: false },
};

/**
 * Where the "Mark paid" link in a reminder email lands. The link is signed
 * (see `~/server/bills/paid-link`), so it works without signing in. It
 * asks for a click instead of settling the bill on load, so email scanners
 * that open links automatically can't mark anything paid.
 */
async function MarkPaidPageContent({
  searchParams,
}: {
  searchParams: Promise<{ bill?: string; sig?: string; done?: string }>;
}) {
  const { bill: billId, sig, done } = await searchParams;

  const bill =
    billId && sig && verifyBillPaid(billId, sig)
      ? await db.bill.findFirst({
          where: { id: billId },
          select: {
            id: true,
            description: true,
            category: true,
            direction: true,
            amount: true,
            paidAmount: true,
            status: true,
            currency: true,
            dueDate: true,
            owner: { select: { currency: true } },
          },
        })
      : null;

  if (!bill || !billId || !sig) {
    return (
      <SlimLayout title="This link isn't valid">
        <Notice tone="error">
          We couldn&apos;t find the bill this link is for. It may have been
          deleted. Sign in to see what&apos;s due.
        </Notice>
        <Button href="/dashboard" variant="outline" className="w-full">
          Open TrackMyEstate
        </Button>
      </SlimLayout>
    );
  }

  const inflow = bill.direction === "INFLOW";
  const name = bill.description ?? EVENT_CATEGORY_LABELS[bill.category];
  const currency = bill.currency ?? bill.owner.currency;
  const billHref = `/bills/${bill.id}`;

  if (!isOpenBill(bill.status)) {
    return (
      <SlimLayout title={inflow ? "Marked as received" : "Marked as paid"}>
        <Notice tone="success">
          {done
            ? `${name} is settled. We won't remind you about it again.`
            : `${name} is already settled, so there's nothing left to do.`}
        </Notice>
        <Button href={billHref} variant="outline" className="w-full">
          View it in TrackMyEstate
        </Button>
      </SlimLayout>
    );
  }

  const outstanding = outstandingAmount(bill);
  const partlyPaid = outstanding < bill.amount;

  return (
    <SlimLayout
      title={inflow ? "Mark this as received?" : "Mark this as paid?"}
      description={`${name} — ${formatMoney(outstanding, currency)}${partlyPaid ? " left" : ""}, ${inflow ? "expected" : "due"} on ${formatDate(bill.dueDate)}.`}
    >
      <form
        action={markBillPaidFromLink.bind(null, billId, sig)}
        className="space-y-5"
      >
        <Field label={inflow ? "Received by" : "Paid by"}>
          <Select name="method" defaultValue="UPI" required>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <SubmitButton size="lg" className="w-full">
          {inflow ? "Mark received" : "Mark paid"}
        </SubmitButton>
      </form>
      <p className="text-sm text-muted">
        This records {formatMoney(outstanding, currency)}{" "}
        {inflow ? "received" : "paid"} today and stops the reminders. For a
        different amount or date,{" "}
        <a
          href={billHref}
          className="font-medium text-accent hover:text-accent-strong"
        >
          record it in TrackMyEstate
        </a>
        .
      </p>
    </SlimLayout>
  );
}

/**
 * What this page shows depends on the address it was opened with, so the
 * frame and title are prerendered and the rest streams in behind them.
 */
export default function MarkPaidPage(
  props: Parameters<typeof MarkPaidPageContent>[0],
) {
  return (
    <>
      <Suspense fallback={<SlimLayoutSkeleton title="Mark as paid" />}>
        <MarkPaidPageContent {...props} />
      </Suspense>
    </>
  );
}
