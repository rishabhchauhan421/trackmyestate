"use client";

import { useMemo, useState } from "react";

import {
  ChoiceCards,
  Field,
  FormSection,
  Input,
  MoneyInput,
  Select,
} from "~/app/_components/form";
import {
  MAX_PLAN_INSTALMENTS,
  PLAN_INTERVAL_LABELS,
  planInstalments,
  type PlanInterval,
} from "~/lib/issues";
import { fromMinorUnits, toMinorUnits } from "~/lib/money";

const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * The "Add payment" form's fields: one payment, or an instalment plan
 * whose even split is previewed as editable rows (builder schedules are
 * rarely even). The rows are submitted as repeated `instalmentAmount` /
 * `instalmentDate` fields; `addDues` saves exactly those.
 */
export function DuesFormFields({ symbol }: { symbol: string }) {
  const [mode, setMode] = useState<"single" | "plan">("single");
  const [total, setTotal] = useState("");
  const [count, setCount] = useState("4");
  const [firstDueDate, setFirstDueDate] = useState("");
  const [interval, setInterval] = useState<PlanInterval>("QUARTERLY");

  const instalments = useMemo(() => {
    const totalNumber = Number(total);
    const countNumber = Number(count);
    if (
      !(totalNumber > 0) ||
      !Number.isInteger(countNumber) ||
      countNumber < 2 ||
      countNumber > MAX_PLAN_INSTALMENTS ||
      !isDay(firstDueDate)
    ) {
      return [];
    }
    return planInstalments({
      total: toMinorUnits(totalNumber),
      count: countNumber,
      firstDueDay: firstDueDate,
      interval,
    });
  }, [total, count, firstDueDate, interval]);
  // Remounts the preview rows (dropping edits) when the plan's terms change.
  const planKey = `${total}:${count}:${firstDueDate}:${interval}`;

  return (
    <>
      <FormSection title="The payment">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="What it's for">
            <Input
              name="label"
              required
              maxLength={80}
              placeholder="e.g. Builder instalment"
            />
          </Field>
          <Field label="Who pays">
            <Select name="direction" defaultValue="OUTFLOW" required>
              <option value="OUTFLOW">I pay this</option>
              <option value="INFLOW">It&apos;s owed to me</option>
            </Select>
          </Field>
        </div>
        <div
          onChange={(event) => {
            const target = event.target as HTMLInputElement;
            if (target.name === "mode") {
              setMode(target.value === "plan" ? "plan" : "single");
            }
          }}
        >
          <ChoiceCards
            legend="How is it paid?"
            name="mode"
            defaultValue="single"
            required
            options={[
              { value: "single", label: "One payment" },
              { value: "plan", label: "Instalment plan" },
            ]}
          />
        </div>
      </FormSection>

      {mode === "single" ? (
        <FormSection title="Amount and date">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Amount"
              hint="An estimate is fine. You can change it until it's paid."
            >
              <MoneyInput symbol={symbol} name="amount" required />
            </Field>
            <Field label="Due on">
              <Input type="date" name="dueDate" required />
            </Field>
          </div>
        </FormSection>
      ) : (
        <FormSection
          title="Instalment plan"
          description="Enter the total and how it's spread. Each instalment can then be adjusted before saving."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Total amount">
              <MoneyInput
                symbol={symbol}
                name="total"
                required
                value={total}
                onChange={(event) => setTotal(event.target.value)}
              />
            </Field>
            <Field label="Number of instalments">
              <Input
                type="number"
                name="count"
                min={2}
                max={MAX_PLAN_INSTALMENTS}
                step={1}
                required
                value={count}
                onChange={(event) => setCount(event.target.value)}
              />
            </Field>
            <Field label="First due on">
              <Input
                type="date"
                name="firstDueDate"
                required
                value={firstDueDate}
                onChange={(event) => setFirstDueDate(event.target.value)}
              />
            </Field>
            <Field label="How often">
              <Select
                name="interval"
                required
                value={interval}
                onChange={(event) =>
                  setInterval(event.target.value as PlanInterval)
                }
              >
                {Object.entries(PLAN_INTERVAL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {instalments.length > 0 && (
            <fieldset key={planKey} className="space-y-2.5">
              <legend className="text-sm font-medium text-ink">
                Instalments
                <span className="font-normal text-muted">
                  {" "}
                  · change any amount or date
                </span>
              </legend>
              <ol className="space-y-2.5">
                {instalments.map((instalment) => (
                  <li
                    key={instalment.number}
                    className="grid grid-cols-[2rem_1fr_1fr] items-center gap-3"
                  >
                    <span className="text-sm text-muted">
                      {instalment.number}.
                    </span>
                    <MoneyInput
                      symbol={symbol}
                      name="instalmentAmount"
                      required
                      aria-label={`Instalment ${instalment.number} amount`}
                      defaultValue={fromMinorUnits(instalment.amount)}
                      className="mt-0"
                    />
                    <Input
                      type="date"
                      name="instalmentDate"
                      required
                      aria-label={`Instalment ${instalment.number} due date`}
                      defaultValue={instalment.dueDay}
                      className="mt-0"
                    />
                  </li>
                ))}
              </ol>
            </fieldset>
          )}
        </FormSection>
      )}
    </>
  );
}
