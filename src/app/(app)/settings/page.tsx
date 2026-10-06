import { notFound, redirect } from "next/navigation";

import { SubmitButton } from "~/app/_components/submit-button";
import { Card } from "~/app/_components/card";
import {
  Field,
  FormActions,
  Input,
  Notice,
  Select,
} from "~/app/_components/form";
import { CURRENCY_LABELS } from "~/lib/labels";
import { timeZoneOptions } from "~/lib/time-zone";
import { updateGeneralSettings } from "~/server/actions/settings";
import { getSession } from "~/server/better-auth/server";
import { getUserSettings } from "~/server/queries/settings";
import { TimeZoneField } from "./time-zone-field";

/** Settings › General: profile and region. */
export default async function GeneralSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const [user, { saved }] = await Promise.all([
    getUserSettings(session.user.id),
    searchParams,
  ]);
  if (!user) notFound();

  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <form
      action={updateGeneralSettings}
      data-gtm-event="general_settings_updated"
      className="space-y-4"
    >
      {saved === "general" && <Notice tone="success">Settings saved.</Notice>}

      <Card aria-labelledby="profile" className="space-y-5 p-5 sm:p-6">
        <div className="space-y-1">
          <h2 id="profile" className="text-base font-semibold text-ink">
            Profile
          </h2>
          <p className="text-[0.8125rem] text-muted">
            Your name appears in reminders sent to your guests.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-full bg-night-3 text-lg font-semibold text-white">
            {initials}
          </span>
          <div>
            <p className="text-[0.9375rem] font-semibold text-ink">
              {user.name}
            </p>
            <p className="text-[0.8125rem] text-muted">{user.email}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Full name">
            <Input
              name="name"
              required
              maxLength={80}
              autoComplete="name"
              defaultValue={user.name}
            />
          </Field>
          <Field
            label="Email"
            hint="Used to sign in — it can't be changed here."
          >
            <Input value={user.email} disabled readOnly />
          </Field>
        </div>
      </Card>

      <Card aria-labelledby="region" className="space-y-5 p-5 sm:p-6">
        <div className="space-y-1">
          <h2 id="region" className="text-base font-semibold text-ink">
            Region
          </h2>
          <p className="text-[0.8125rem] text-muted">
            Decides what &ldquo;today&rdquo; is for due dates and when reminders
            arrive.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TimeZoneField
            options={timeZoneOptions()}
            defaultValue={user.timezone}
          />
          <Field label="Currency">
            <Select name="currency" defaultValue={user.currency}>
              {Object.entries(CURRENCY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <FormActions>
        <SubmitButton>Save changes</SubmitButton>
      </FormActions>
    </form>
  );
}
