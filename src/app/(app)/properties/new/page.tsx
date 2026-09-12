import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { PageHeader } from "~/app/_components/page-header";
import { PROPERTY_TYPE_LABELS } from "~/lib/labels";
import { createProperty } from "~/server/actions/properties";
import { getSession } from "~/server/better-auth/server";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const labelClass = "text-xs font-medium text-slate-600 dark:text-slate-300";

export default async function NewPropertyPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <>
      <div>
        <Link
          href="/properties"
          className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          ← Properties
        </Link>
      </div>

      <PageHeader
        title="Add property"
        description="Add a property to start tracking rent, utility bills, occupancy and any linked loan or insurance."
      />

      <form
        action={createProperty}
        data-gtm-event="property_created"
        className="max-w-xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Name</label>
            <input
              type="text"
              name="name"
              required
              placeholder="e.g. Whitefield Apartment"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Type</label>
            <select
              name="type"
              required
              defaultValue="SELF_OCCUPIED"
              className={inputClass}
            >
              {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Address line 1</label>
          <input
            type="text"
            name="addressLine1"
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Address line 2 (optional)</label>
          <input type="text" name="addressLine2" className={inputClass} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>City</label>
            <input type="text" name="city" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>State</label>
            <input type="text" name="state" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>PIN code</label>
            <input
              type="text"
              name="pinCode"
              required
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Country</label>
          <input
            type="text"
            name="country"
            defaultValue="India"
            className={`${inputClass} sm:w-56`}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Purchase price (₹, optional)</label>
            <input
              type="number"
              name="purchasePrice"
              min="0"
              step="1"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Current estimated value (₹, optional)</label>
            <input
              type="number"
              name="currentEstimatedValue"
              min="0"
              step="1"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Purchase date (optional)</label>
          <input
            type="date"
            name="purchaseDate"
            className={`${inputClass} sm:w-56`}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit">Save property</Button>
          <Link
            href="/properties"
            className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
