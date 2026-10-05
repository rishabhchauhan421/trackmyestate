import { redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { Notice } from "~/app/_components/form";
import { PageHeader } from "~/app/_components/page-header";
import { reminderCategoryConfig } from "~/lib/reminders";
import { timeZoneOptions } from "~/lib/time-zone";
import {
  resetCategoryReminders,
  updateReminderSettings,
  updateTimeZone,
} from "~/server/actions/settings";
import { getSession } from "~/server/better-auth/server";
import { getUserTimeZone } from "~/server/queries/settings";
import { getReminderSettings } from "~/server/reminders/rules";
import { ReminderChips } from "./reminder-chips";
import { TimeZoneField } from "./time-zone-field";

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 ${
        on ? "bg-accent" : "bg-line"
      }`}
    >
      <span
        className={`h-4 w-4 rounded-full bg-surface shadow transition-transform ${
          on ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </span>
  );
}

function SettingsRow({
  label,
  description,
  on,
}: {
  label: string;
  description: string;
  on: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      <Toggle on={on} />
    </div>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-6">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <div className="mt-1 divide-y divide-line-soft">{children}</div>
    </div>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const [timeZone, reminderSettings, { saved }] = await Promise.all([
    getUserTimeZone(session.user.id),
    getReminderSettings(session.user.id),
    searchParams,
  ]);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your profile, security and how you'd like to be reminded."
      />

      <SettingsSection title="Region">
        <form
          action={updateTimeZone}
          data-gtm-event="time_zone_updated"
          className="space-y-4 py-4"
        >
          {saved === "timezone" && (
            <Notice tone="success">Time zone saved.</Notice>
          )}
          <TimeZoneField options={timeZoneOptions()} defaultValue={timeZone} />
          <p className="text-xs text-muted">
            Reminders go out in the morning in this time zone, and due dates
            count as &ldquo;today&rdquo; by it.
          </p>
          <Button type="submit" size="sm">
            Save time zone
          </Button>
        </form>
      </SettingsSection>

      <SettingsSection title="Security">
        <SettingsRow
          label="Two-factor authentication"
          description="Require a second step to sign in"
          on={false}
        />
        <SettingsRow
          label="Biometric unlock"
          description="Face ID / fingerprint on this device"
          on={false}
        />
      </SettingsSection>

      <SettingsSection title="Reminders">
        <form
          action={updateReminderSettings}
          data-gtm-event="reminders_updated"
          className="space-y-1 pt-3"
        >
          <p className="pb-2 text-xs leading-relaxed text-muted">
            When to remind you, by kind of payment — sent by email at 9 am in
            your time zone. Reminders after the due date go out only while
            it&apos;s still unpaid, and every reminder stops once a bill is
            marked paid.
          </p>
          {saved === "reminders" && (
            <Notice tone="success">Reminders saved.</Notice>
          )}
          <div className="divide-y divide-line-soft">
            {reminderSettings.map((setting) => {
              const config = reminderCategoryConfig(setting.category);
              return (
                <div
                  key={setting.category}
                  className="grid gap-3 py-4 lg:grid-cols-[14rem_1fr]"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {config.label}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {config.description}
                    </p>
                    <p className="mt-1.5 text-xs">
                      {setting.customised ? (
                        <>
                          <span className="font-medium text-ink-2">
                            Customised
                          </span>
                          {" · "}
                          <button
                            formAction={resetCategoryReminders.bind(
                              null,
                              setting.category,
                            )}
                            formNoValidate
                            className="font-medium text-accent hover:text-accent-strong"
                          >
                            Reset to default
                          </button>
                        </>
                      ) : (
                        <span className="text-muted">Default</span>
                      )}
                    </p>
                  </div>
                  <ReminderChips
                    name={`offsets.${setting.category}`}
                    label={config.label}
                    defaultSelected={setting.offsets}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
            <p className="text-xs text-muted">
              Channels: Email · WhatsApp, SMS and push coming soon
            </p>
            <Button type="submit" size="sm">
              Save reminders
            </Button>
          </div>
        </form>
      </SettingsSection>

      <SettingsSection title="Privacy">
        <SettingsRow
          label="Weekly digest"
          description="A summary of everything due or expected this month"
          on={true}
        />
      </SettingsSection>
    </>
  );
}
