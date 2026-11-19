import { Field, Input, MoneyInput, Select } from "~/app/_components/form";
import { toDateInputValue } from "~/lib/format";
import { FREQUENCY_LABELS } from "~/lib/labels";
import { optionalFromMinorUnits } from "~/lib/money";
import type { PolicyPaymentDefaults } from "~/server/queries/policies";

/**
 * The premium and payout fields shared by the add and edit policy forms.
 * Each group is all-or-nothing (checked by `~/server/actions/policies`):
 * with a premium we add every premium to the timeline and remind before
 * it's due; with a payout, the one-off amount coming in.
 */
export function PolicyPaymentFields({
  defaults,
  symbol,
}: {
  defaults?: PolicyPaymentDefaults;
  /** The policy's currency symbol (see `currencySymbol`). */
  symbol: string;
}) {
  return (
    <>
      <div className="space-y-1 border-t border-line-soft pt-5">
        <h2 className="text-base font-semibold text-ink">
          Premium{" "}
          <span className="text-sm font-normal text-muted">· optional</span>
        </h2>
        <p className="text-sm text-muted">
          We&apos;ll put every premium on your timeline and remind you before
          it&apos;s due, until the policy&apos;s term ends.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Amount">
          <MoneyInput
            symbol={symbol}
            name="premiumAmount"
            defaultValue={optionalFromMinorUnits(defaults?.premiumAmount) ?? ""}
          />
        </Field>
        <Field label="Paid">
          <Select
            name="premiumFrequency"
            defaultValue={defaults?.premiumFrequency ?? ""}
          >
            <option value="">Choose…</option>
            {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Next due on" hint="Later premiums follow from this date.">
          <Input
            type="date"
            name="premiumDueDate"
            defaultValue={
              defaults?.premiumDueDate
                ? toDateInputValue(defaults.premiumDueDate)
                : ""
            }
          />
        </Field>
      </div>

      <div className="space-y-1 border-t border-line-soft pt-5">
        <h2 className="text-base font-semibold text-ink">
          Maturity or payout{" "}
          <span className="text-sm font-normal text-muted">· optional</span>
        </h2>
        <p className="text-sm text-muted">
          Money the policy pays you on a date, such as a maturity benefit.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Amount">
          <MoneyInput
            symbol={symbol}
            name="payoutAmount"
            defaultValue={optionalFromMinorUnits(defaults?.payoutAmount) ?? ""}
          />
        </Field>
        <Field label="Paid out on">
          <Input
            type="date"
            name="payoutDate"
            defaultValue={
              defaults?.payoutDate ? toDateInputValue(defaults.payoutDate) : ""
            }
          />
        </Field>
      </div>
    </>
  );
}
