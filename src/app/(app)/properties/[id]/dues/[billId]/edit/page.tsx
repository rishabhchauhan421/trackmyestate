import { notFound } from "next/navigation";

import { ActionForm } from "~/app/_components/action-form";
import { Button } from "~/app/_components/button";
import {
  Field,
  FormActions,
  FormSection,
  Input,
  MoneyInput,
} from "~/app/_components/form";
import { PageHeader, propertyCrumbs } from "~/app/_components/page-header";
import { SubmitButton } from "~/app/_components/submit-button";
import { currencySymbol, toDateInputValue } from "~/lib/format";
import { fromMinorUnits } from "~/lib/money";
import { removeDue, updateDueForm } from "~/server/actions/issues";
import { requireScope } from "~/server/households";
import { getBillForHousehold } from "~/server/queries/bills";
import { getUserCurrency } from "~/server/queries/settings";
import { OPEN_PAYMENT_STATUSES } from "~/server/queries/shared";

export default async function EditDuePage({
  params,
}: {
  params: Promise<{ id: string; billId: string }>;
}) {
  const [{ id, billId }, scope] = await Promise.all([params, requireScope()]);
  const bill = await getBillForHousehold(billId, scope.householdId);
  if (
    bill?.property?.id !== id ||
    bill.category !== "PROPERTY_DUE" ||
    !(OPEN_PAYMENT_STATUSES as readonly string[]).includes(bill.status)
  ) {
    notFound();
  }
  const symbol = currencySymbol(
    bill.currency ?? (await getUserCurrency(scope.userId)),
  );
  const back = `/bills/${bill.id}`;
  const label = bill.description ?? "Payment";

  return (
    <>
      <PageHeader
        breadcrumbs={[
          ...propertyCrumbs(bill.property),
          { label, href: back },
          { label: "Edit" },
        ]}
        title="Edit payment"
        description="Firm up an estimate or move the date. Reminders follow the new date."
      />

      <div className="max-w-3xl space-y-5">
        <ActionForm
          action={updateDueForm.bind(null, bill.id)}
          className="space-y-5"
        >
          <FormSection title="The payment">
            <Field label="What it's for">
              <Input
                name="label"
                required
                maxLength={80}
                defaultValue={label}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Amount">
                <MoneyInput
                  symbol={symbol}
                  name="amount"
                  required
                  defaultValue={fromMinorUnits(bill.amount)}
                />
              </Field>
              <Field label="Due on">
                <Input
                  type="date"
                  name="dueDate"
                  required
                  defaultValue={toDateInputValue(bill.dueDate)}
                />
              </Field>
            </div>
          </FormSection>
          <FormActions>
            <Button href={back} variant="outline">
              Cancel
            </Button>
            <SubmitButton>Save changes</SubmitButton>
          </FormActions>
        </ActionForm>

        {bill.status !== "PARTIALLY_PAID" && (
          <FormSection
            title="Remove this payment"
            description="For a payment that no longer applies. Its reminders stop."
          >
            <form action={removeDue.bind(null, bill.id)}>
              <SubmitButton variant="outline" color="red">
                Remove payment
              </SubmitButton>
            </form>
          </FormSection>
        )}
      </div>
    </>
  );
}
