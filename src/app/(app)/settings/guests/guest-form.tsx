import type { Guest } from "../../../../../generated/prisma";
import { Button } from "~/app/_components/button";
import {
  Field,
  FormActions,
  Input,
  Select,
  labelClass,
} from "~/app/_components/form";
import { localMobileDigits } from "~/lib/phone";
import { REMINDER_CATEGORIES } from "~/lib/reminders";

const RELATIONSHIPS = [
  "Family",
  "Tenant",
  "Accountant",
  "Property manager",
  "Other",
];

const CHANNEL_OPTIONS = [
  { value: "EMAIL", label: "Email", note: null },
  { value: "WHATSAPP", label: "WhatsApp", note: "coming soon" },
  { value: "SMS", label: "SMS", note: "coming soon" },
] as const;

/** A checkbox drawn as a selectable pill. */
const pillClass =
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink-2 transition-colors has-checked:border-accent has-checked:bg-accent-soft has-checked:text-ink has-focus-visible:ring-2 has-focus-visible:ring-accent/40";
const checkboxClass =
  "size-4.5 rounded border-line-strong text-accent focus:ring-accent";

/**
 * Add/edit guest form, shared by `/settings/guests/new` and
 * `/settings/guests/[id]/edit`. Field names match `parseGuestForm` in
 * `~/server/actions/guests`.
 */
export function GuestForm({
  action,
  guest,
  properties,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  guest?: Guest;
  properties: { id: string; name: string }[];
  submitLabel: string;
}) {
  const someProperties = (guest?.propertyIds.length ?? 0) > 0;

  return (
    <form
      action={action}
      data-gtm-event={guest ? "guest_updated" : "guest_added"}
      className="space-y-6 rounded-card border border-line bg-surface p-5 sm:p-6"
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Name">
          <Input
            name="name"
            required
            maxLength={80}
            defaultValue={guest?.name}
          />
        </Field>
        <Field label="Relationship" optional>
          <Select name="relationship" defaultValue={guest?.relationship ?? ""}>
            <option value="">Choose…</option>
            {RELATIONSHIPS.map((relationship) => (
              <option key={relationship} value={relationship}>
                {relationship}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Email">
          <Input
            type="email"
            name="email"
            autoComplete="off"
            defaultValue={guest?.email ?? ""}
          />
        </Field>
        <Field label="Mobile">
          <span className="mt-1.5 flex overflow-hidden rounded-control border border-line-strong bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
            <span className="flex items-center border-r border-line bg-sunken px-3 text-[0.9375rem] text-muted">
              +91
            </span>
            <input
              name="mobile"
              inputMode="tel"
              autoComplete="off"
              placeholder="98765 43210"
              defaultValue={localMobileDigits(guest?.phone)}
              className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-[0.9375rem] text-ink placeholder:text-muted/80 focus:ring-0 focus:outline-none"
            />
          </span>
        </Field>
      </div>
      <p className="-mt-3 text-xs text-muted">
        Add an email, a mobile number or both.
      </p>

      <fieldset>
        <legend className={labelClass}>Send by</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {CHANNEL_OPTIONS.map((channel) => (
            <label key={channel.value} className={pillClass}>
              <input
                type="checkbox"
                name="channels"
                value={channel.value}
                defaultChecked={
                  guest
                    ? guest.channels.includes(channel.value)
                    : channel.value === "EMAIL"
                }
                className={checkboxClass}
              />
              {channel.label}
              {channel.note && (
                <span className="text-xs font-normal text-muted">
                  · {channel.note}
                </span>
              )}
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Only email is delivered today — WhatsApp and SMS are saved and start
          once they launch.
        </p>
      </fieldset>

      <fieldset>
        <legend className={labelClass}>Remind them about</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {REMINDER_CATEGORIES.map((category) => (
            <label key={category.category} className={pillClass}>
              <input
                type="checkbox"
                name="categories"
                value={category.category}
                defaultChecked={guest?.categories.includes(category.category)}
                className={checkboxClass}
              />
              {category.label}
            </label>
          ))}
        </div>
      </fieldset>

      {properties.length > 0 && (
        <fieldset className="space-y-2.5">
          <legend className={labelClass}>For which properties</legend>
          <p className="text-xs text-muted">
            Applies to utility bills and rent. Premiums, EMIs and returns
            aren&apos;t tied to a property.
          </p>
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <input
                type="radio"
                name="propertyScope"
                value="all"
                defaultChecked={!someProperties}
                className="size-4.5 border-line-strong text-accent focus:ring-accent"
              />
              All my properties
            </label>
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <input
                type="radio"
                name="propertyScope"
                value="some"
                defaultChecked={someProperties}
                className="size-4.5 border-line-strong text-accent focus:ring-accent"
              />
              Only these:
            </label>
          </div>
          <div className="ml-7 overflow-hidden rounded-xl border border-line">
            {properties.map((property) => (
              <label
                key={property.id}
                className="flex cursor-pointer items-center gap-3 border-b border-line-soft px-3.5 py-3 text-sm font-medium text-ink last:border-0 hover:bg-sunken"
              >
                <input
                  type="checkbox"
                  name="propertyIds"
                  value={property.id}
                  defaultChecked={guest?.propertyIds.includes(property.id)}
                  className={checkboxClass}
                />
                {property.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="space-y-2">
        <legend className={labelClass}>When</legend>
        <label className="flex items-center gap-2.5 text-sm text-ink">
          <input
            type="radio"
            name="when"
            value="schedule"
            defaultChecked={!guest?.dueDayOnly}
            className="size-4.5 border-line-strong text-accent focus:ring-accent"
          />
          Same schedule as yours
        </label>
        <label className="flex items-center gap-2.5 text-sm text-ink">
          <input
            type="radio"
            name="when"
            value="dueDay"
            defaultChecked={guest?.dueDayOnly}
            className="size-4.5 border-line-strong text-accent focus:ring-accent"
          />
          Only on the due day
        </label>
      </fieldset>

      {!guest && (
        <p className="rounded-xl bg-sunken px-4 py-3.5 text-[0.8125rem] leading-relaxed text-ink-2">
          We&apos;ll email them once to say you&apos;ve added them, with a link
          to stop. Every reminder has that link too, and only shows the
          item&apos;s name, the amount and the due date.
        </p>
      )}

      <FormActions>
        <Button href="/settings/guests" variant="outline">
          Cancel
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </FormActions>
    </form>
  );
}
