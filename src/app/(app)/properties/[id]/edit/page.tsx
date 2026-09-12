import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { PageHeader } from "~/app/_components/page-header";
import { toDateInputValue } from "~/lib/format";
import {
  OWNERSHIP_TYPE_LABELS,
  PROPERTY_CATEGORY_LABELS,
  PROPERTY_TYPE_LABELS,
} from "~/lib/labels";
import { deleteProperty, updateProperty } from "~/server/actions/properties";
import { getSession } from "~/server/better-auth/server";
import {
  getPropertyForOwner,
  hasDependentRecordsForProperty,
} from "~/server/queries/properties";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const labelClass = "text-xs font-medium text-slate-600 dark:text-slate-300";

export default async function EditPropertyPage({
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

  const hasDependents = await hasDependentRecordsForProperty(id);

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
        title={`Edit ${property.name}`}
        description="Update this property's details, including its current estimated value."
      />

      <form
        action={updateProperty.bind(null, property.id)}
        data-gtm-event="property_updated"
        className="max-w-xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Name</label>
            <input
              type="text"
              name="name"
              required
              defaultValue={property.name}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Type</label>
            <select
              name="type"
              required
              defaultValue={property.type}
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Unique Property ID (optional)</label>
            <input
              type="text"
              name="uniquePropertyId"
              placeholder="e.g. municipal / survey number"
              defaultValue={property.uniquePropertyId ?? ""}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Property category (optional)</label>
            <select
              name="propertyCategory"
              defaultValue={property.propertyCategory ?? ""}
              className={inputClass}
            >
              <option value="">Select category</option>
              {Object.entries(PROPERTY_CATEGORY_LABELS).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </div>
          <div>
            <label className={labelClass}>Ownership type (optional)</label>
            <select
              name="ownershipType"
              defaultValue={property.ownershipType ?? ""}
              className={inputClass}
            >
              <option value="">Select ownership type</option>
              {Object.entries(OWNERSHIP_TYPE_LABELS).map(([value, label]) => (
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
            defaultValue={property.addressLine1}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Address line 2 (optional)</label>
          <input
            type="text"
            name="addressLine2"
            defaultValue={property.addressLine2 ?? ""}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass}>City</label>
            <input
              type="text"
              name="city"
              required
              defaultValue={property.city}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>State</label>
            <input
              type="text"
              name="state"
              required
              defaultValue={property.state}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>PIN code</label>
            <input
              type="text"
              name="pinCode"
              required
              defaultValue={property.pinCode}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Country</label>
          <input
            type="text"
            name="country"
            defaultValue={property.country}
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
              defaultValue={property.purchasePrice ?? ""}
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
              defaultValue={property.currentEstimatedValue ?? ""}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Purchase date (optional)</label>
          <input
            type="date"
            name="purchaseDate"
            defaultValue={
              property.purchaseDate
                ? toDateInputValue(property.purchaseDate)
                : ""
            }
            className={`${inputClass} sm:w-56`}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit">Save changes</Button>
          <Link
            href="/properties"
            className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Cancel
          </Link>
        </div>
      </form>

      <div className="max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Delete property
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {hasDependents
              ? "This property has leases, rental units, utilities or bills on record, so it can't be deleted."
              : "Permanently removes this property. Only possible when it has no leases, rental units, utilities or bills on record."}
          </p>
        </div>
        <form
          action={deleteProperty.bind(null, property.id)}
          data-gtm-event="property_deleted"
        >
          <Button
            type="submit"
            variant="outline"
            color="red"
            disabled={hasDependents}
            title={hasDependents ? "Dependent records exist for this property" : undefined}
          >
            Delete property
          </Button>
        </form>
      </div>
    </>
  );
}
