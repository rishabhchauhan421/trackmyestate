"use client";

import { useState } from "react";

import { controlClass, labelClass } from "~/app/_components/form";

/**
 * The utility form's billing type + amount pair. A variable (usage-based)
 * bill's amount is only an estimate, so its label says "Approx. amount"
 * and switches as soon as the billing type changes.
 */
export function BillingFields() {
  const [billingType, setBillingType] = useState("VARIABLE");
  const variable = billingType === "VARIABLE";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <label className="block">
        <span className={labelClass}>Billing type</span>
        <select
          name="billingType"
          value={billingType}
          onChange={(event) => setBillingType(event.target.value)}
          className={controlClass}
        >
          <option value="VARIABLE">Variable (meter/usage-based)</option>
          <option value="FIXED">Fixed amount</option>
        </select>
      </label>
      <label className="block">
        <span className={labelClass}>
          {variable ? "Approx. amount (₹)" : "Amount (₹)"}
        </span>
        <input
          type="number"
          name="defaultAmount"
          min="1"
          step="1"
          required
          className={controlClass}
        />
        {variable && (
          <span className="mt-1.5 block text-xs text-muted">
            A typical bill — shown as approximate until you record what you
            actually paid.
          </span>
        )}
      </label>
    </div>
  );
}
