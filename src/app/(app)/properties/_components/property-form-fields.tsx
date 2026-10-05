import type { Property } from "../../../../../generated/prisma";
import {
  ChoiceCards,
  Field,
  FormSection,
  Input,
  MoneyInput,
  Select,
} from "~/app/_components/form";
import { toDateInputValue } from "~/lib/format";
import {
  OWNERSHIP_TYPE_LABELS,
  PROPERTY_CATEGORY_LABELS,
  PROPERTY_TYPE_LABELS,
} from "~/lib/labels";

function options(labels: Record<string, string>) {
  return Object.entries(labels).map(([value, label]) => ({ value, label }));
}

/**
 * The Property form's fields, shared by the add and edit pages. Pass
 * `property` to prefill them for editing. Field names match the Server
 * Action's schema in `~/server/actions/properties`.
 */
export function PropertyFormFields({ property }: { property?: Property }) {
  return (
    <>
      <FormSection title="Basics">
        <Field label="Property name">
          <Input
            type="text"
            name="name"
            required
            placeholder="e.g. Whitefield Apartment"
            defaultValue={property?.name}
          />
        </Field>
        <ChoiceCards
          legend="How is it used?"
          name="type"
          required
          options={options(PROPERTY_TYPE_LABELS)}
          defaultValue={property?.type ?? "SELF_OCCUPIED"}
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Category" optional>
            <Select
              name="propertyCategory"
              defaultValue={property?.propertyCategory ?? ""}
            >
              <option value="">Select category</option>
              {options(PROPERTY_CATEGORY_LABELS).map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ownership" optional>
            <Select
              name="ownershipType"
              defaultValue={property?.ownershipType ?? ""}
            >
              <option value="">Select ownership type</option>
              {options(OWNERSHIP_TYPE_LABELS).map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field
          label="Property ID"
          optional
          hint="A municipal, survey or khata number — whatever identifies it officially."
        >
          <Input
            type="text"
            name="uniquePropertyId"
            defaultValue={property?.uniquePropertyId ?? ""}
          />
        </Field>
      </FormSection>

      <FormSection title="Address">
        <Field label="Address line 1">
          <Input
            type="text"
            name="addressLine1"
            required
            placeholder="Flat, building, street"
            autoComplete="address-line1"
            defaultValue={property?.addressLine1}
          />
        </Field>
        <Field label="Address line 2" optional>
          <Input
            type="text"
            name="addressLine2"
            placeholder="Area, landmark"
            autoComplete="address-line2"
            defaultValue={property?.addressLine2 ?? ""}
          />
        </Field>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Field label="City">
            <Input
              type="text"
              name="city"
              required
              autoComplete="address-level2"
              defaultValue={property?.city}
            />
          </Field>
          <Field label="State">
            <Input
              type="text"
              name="state"
              required
              autoComplete="address-level1"
              defaultValue={property?.state}
            />
          </Field>
          <Field label="PIN code">
            <Input
              type="text"
              name="pinCode"
              required
              inputMode="numeric"
              autoComplete="postal-code"
              defaultValue={property?.pinCode}
            />
          </Field>
        </div>
        <Field label="Country" className="sm:max-w-60">
          <Input
            type="text"
            name="country"
            autoComplete="country-name"
            defaultValue={property?.country ?? "India"}
          />
        </Field>
      </FormSection>

      <FormSection
        title="Value"
        optional
        description="Used for your net worth and the gain since purchase."
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Field label="Purchase price">
            <MoneyInput
              name="purchasePrice"
              step="1"
              defaultValue={property?.purchasePrice ?? undefined}
            />
          </Field>
          <Field label="Purchase date">
            <Input
              type="date"
              name="purchaseDate"
              defaultValue={
                property?.purchaseDate
                  ? toDateInputValue(property.purchaseDate)
                  : ""
              }
            />
          </Field>
          <Field label="Current estimated value">
            <MoneyInput
              name="currentEstimatedValue"
              step="1"
              defaultValue={property?.currentEstimatedValue ?? undefined}
            />
          </Field>
        </div>
      </FormSection>
    </>
  );
}
