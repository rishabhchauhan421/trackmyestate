"use client";

import clsx from "clsx";
import { useState } from "react";

import {
  MAX_REMINDERS_PER_CATEGORY,
  REMINDER_OFFSET_PRESETS,
  formatReminderOffset,
} from "~/lib/reminders";

/**
 * One category's reminder offsets as toggle chips (checkboxes named
 * `name`, one value per checked chip). Stops at
 * `MAX_REMINDERS_PER_CATEGORY` by disabling the unchecked chips.
 */
export function ReminderChips({
  name,
  label,
  defaultSelected,
}: {
  name: string;
  label: string;
  defaultSelected: number[];
}) {
  const [selected, setSelected] = useState(() => new Set(defaultSelected));
  const atMax = selected.size >= MAX_REMINDERS_PER_CATEGORY;

  function toggle(offset: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(offset)) next.delete(offset);
      else next.add(offset);
      return next;
    });
  }

  return (
    <fieldset>
      <legend className="sr-only">{label} reminders</legend>
      <div className="flex flex-wrap gap-1.5">
        {REMINDER_OFFSET_PRESETS.map((offset) => {
          const checked = selected.has(offset);
          const disabled = !checked && atMax;
          return (
            <label
              key={offset}
              className={clsx(
                "inline-flex h-9 items-center rounded-full border px-3 text-[0.8125rem] font-medium transition-colors has-focus-visible:ring-2 has-focus-visible:ring-accent/40",
                checked
                  ? "border-accent bg-accent-soft text-accent-strong"
                  : "border-line-strong bg-surface text-ink-2",
                disabled
                  ? "cursor-not-allowed opacity-40"
                  : "cursor-pointer hover:border-accent/60",
              )}
            >
              <input
                type="checkbox"
                name={name}
                value={offset}
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(offset)}
                className="sr-only"
              />
              {formatReminderOffset(offset)}
            </label>
          );
        })}
      </div>
      {selected.size === 0 && (
        <p className="mt-1.5 text-xs text-warn">
          No reminders for this kind of payment.
        </p>
      )}
      {atMax && (
        <p className="mt-1.5 text-xs text-muted">
          Up to {MAX_REMINDERS_PER_CATEGORY} reminders each.
        </p>
      )}
    </fieldset>
  );
}
