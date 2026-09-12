import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { PageHeader } from "~/app/_components/page-header";
import { BILL_TYPE_LABELS, UTILITY_RECURRENCE_LABELS } from "~/lib/labels";
import { createUtility } from "~/server/actions/utilities";
import { getSession } from "~/server/better-auth/server";
import { getPropertyForOwner } from "~/server/queries/properties";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const labelClass =
  "text-xs font-medium text-slate-600 dark:text-slate-300";

export default async function NewUtilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const property = await getPropertyForOwner(id, session.user.id);
  if (!property) {
    notFound();
  }

  return (
    <>
      <div>
        <Link
          href={`/properties/${id}/utilities`}
          className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          ← {property.name} utilities
        </Link>
      </div>

      <PageHeader
        title="Add utility"
        description="Set up a recurring bill schedule for this property. Bills are generated automatically, on the date of each cycle's first reminder — you can add who to notify afterwards."
      />

      <form
        action={createUtility}
        data-gtm-event="utility_created"
        className="max-w-xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <input type="hidden" name="propertyId" value={id} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Type</label>
            <select name="type" required defaultValue="ELECTRICITY" className={inputClass}>
              {Object.entries(BILL_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Recurrence</label>
            <select
              name="recurrence"
              required
              defaultValue="MONTHLY"
              className={inputClass}
            >
              {Object.entries(UTILITY_RECURRENCE_LABELS).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Provider (optional)</label>
            <input
              type="text"
              name="provider"
              placeholder="e.g. BESCOM"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Account number (optional)</label>
            <input type="text" name="accountNumber" className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Billing type</label>
            <select
              name="billingType"
              defaultValue="VARIABLE"
              className={inputClass}
            >
              <option value="VARIABLE">Variable (meter/usage-based)</option>
              <option value="FIXED">Fixed amount</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Amount (₹)</label>
            <input
              type="number"
              name="defaultAmount"
              min="1"
              step="1"
              required
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>First due date</label>
          <input
            type="date"
            name="firstDueDate"
            required
            className={`${inputClass} sm:w-56`}
          />
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Sets the recurring due day (and month, for yearly bills) —
            doesn&apos;t create a bill itself.
          </p>
        </div>

        <div>
          <label className={labelClass}>Remind me this many days before</label>
          <input
            type="number"
            name="reminderLeadDays"
            min="0"
            defaultValue={7}
            className={`${inputClass} sm:w-40`}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit">Save utility</Button>
          <Link
            href={`/properties/${id}/utilities`}
            className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
