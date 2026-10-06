import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SubmitButton } from "~/app/_components/submit-button";
import { Card } from "~/app/_components/card";
import { Notice } from "~/app/_components/form";
import { CheckIcon } from "~/app/_components/icons";
import { formatReminderHour, reminderCategoryConfig } from "~/lib/reminders";
import {
  resetCategoryReminders,
  updateReminderSettings,
} from "~/server/actions/settings";
import { getSession } from "~/server/better-auth/server";
import { getGuests } from "~/server/queries/guests";
import { getUserSettings } from "~/server/queries/settings";
import { SEND_HOUR } from "~/server/reminders/generate";
import { getReminderSettings } from "~/server/reminders/rules";
import { ReminderChips } from "./reminder-chips";

const sectionLabel =
  "mr-1 text-xs font-semibold tracking-[0.04em] text-muted uppercase";

/** Settings › Reminders: when, and on which channels, per kind of payment. */
export default async function ReminderSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const [user, settings, guests, { saved }] = await Promise.all([
    getUserSettings(session.user.id),
    getReminderSettings(session.user.id),
    getGuests(session.user.id),
    searchParams,
  ]);
  if (!user) notFound();

  const activeGuests = guests.filter((g) => !g.pausedAt && !g.optedOutAt);

  return (
    <>
      <section
        aria-label="Delivery"
        className="flex flex-wrap items-center gap-x-7 gap-y-4 rounded-card bg-night px-5 py-5 text-white sm:px-6"
      >
        <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-night-3 text-mint">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              className="size-5"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </span>
          <div>
            <p className="text-[0.9375rem] font-semibold">
              Sent at {formatReminderHour(user.reminderHour ?? SEND_HOUR)},{" "}
              {user.timezone.replaceAll("_", " ")}
            </p>
            <p className="text-[0.8125rem] text-night-ink">
              Follow-ups after the due date go out only while it&apos;s unpaid
            </p>
          </div>
        </div>
        <p className="flex items-center gap-2 text-[0.8125rem] text-night-ink">
          <CheckIcon className="size-4.5 text-mint" />
          Reminders stop as soon as a bill is marked paid
        </p>
        <Link
          href="/settings/channels"
          className="text-[0.8125rem] font-semibold text-mint hover:text-white"
        >
          Change in Channels →
        </Link>
      </section>

      <form action={updateReminderSettings} data-gtm-event="reminders_updated">
        <Card aria-labelledby="schedule">
          <div className="space-y-1 border-b border-line-soft px-5 py-4 sm:px-6">
            <h2 id="schedule" className="text-base font-semibold text-ink">
              When and how to remind you
            </h2>
            <p className="text-[0.8125rem] text-muted">
              Pick up to 5 reminders for each kind of payment, and how
              they&apos;re sent.
            </p>
            {saved === "reminders" && (
              <div className="pt-2">
                <Notice tone="success">Reminders saved.</Notice>
              </div>
            )}
          </div>

          <div className="divide-y divide-line-soft">
            {settings.map((setting) => {
              const config = reminderCategoryConfig(setting.category);
              const kindGuests = activeGuests.filter((g) =>
                g.categories.includes(setting.category),
              );
              return (
                <div
                  key={setting.category}
                  className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:gap-7"
                >
                  <div className="space-y-1">
                    <p className="text-[0.9375rem] font-semibold text-ink">
                      {config.label}
                    </p>
                    <p className="text-[0.8125rem] leading-snug text-muted">
                      {config.description}
                    </p>
                    <p className="pt-1 text-xs">
                      {setting.customised ? (
                        <>
                          <span className="font-semibold text-ink-2">
                            Customised
                          </span>
                          {" · "}
                          <button
                            formAction={resetCategoryReminders.bind(
                              null,
                              setting.category,
                            )}
                            formNoValidate
                            className="font-semibold text-accent hover:text-accent-strong"
                          >
                            Reset to default
                          </button>
                        </>
                      ) : (
                        <span className="text-muted">Default</span>
                      )}
                    </p>
                  </div>

                  <div className="min-w-0 space-y-3.5">
                    <ReminderChips
                      name={`offsets.${setting.category}`}
                      label={config.label}
                      defaultSelected={setting.offsets}
                    />

                    <fieldset className="flex flex-wrap items-center gap-2">
                      <legend className="sr-only">
                        {config.label}: send by
                      </legend>
                      <span aria-hidden="true" className={sectionLabel}>
                        Send by
                      </span>
                      <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-[0.8125rem] font-medium text-muted has-checked:border-accent has-checked:text-ink has-focus-visible:ring-2 has-focus-visible:ring-accent/40">
                        <input
                          type="checkbox"
                          name={`channels.${setting.category}`}
                          value="EMAIL"
                          defaultChecked={setting.channels.includes("EMAIL")}
                          className="size-3.5 rounded border-line-strong text-accent focus:ring-0"
                        />
                        Email
                      </label>
                      {(["SMS", "WhatsApp"] as const).map((channel) =>
                        user.phone ? (
                          <span
                            key={channel}
                            title="Delivery isn't available yet"
                            className="inline-flex h-8 items-center rounded-lg border border-dashed border-line-strong px-3 text-[0.8125rem] font-medium text-muted"
                          >
                            {channel} · coming soon
                          </span>
                        ) : (
                          <Link
                            key={channel}
                            href="/settings/channels"
                            className="inline-flex h-8 items-center rounded-lg border border-dashed border-line-strong px-3 text-[0.8125rem] font-medium text-muted hover:border-accent hover:text-ink"
                          >
                            {channel} · Set up
                          </Link>
                        ),
                      )}
                    </fieldset>

                    {kindGuests.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={sectionLabel}>Also notify</span>
                        {kindGuests.map((guest) => (
                          <Link
                            key={guest.id}
                            href="/settings/guests"
                            className="inline-flex h-7 items-center gap-1.5 rounded-full bg-sunken pr-2.5 pl-1 text-[0.8125rem] text-ink hover:bg-sunken-2"
                          >
                            <span className="flex size-5 items-center justify-center rounded-full bg-accent-soft text-[0.625rem] font-bold text-accent-strong">
                              {guest.name.charAt(0).toUpperCase()}
                            </span>
                            {guest.name}
                            {guest.relationship && (
                              <span className="text-muted">
                                · {guest.relationship}
                              </span>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft bg-sunken px-5 py-4 sm:px-6">
            <p className="text-[0.8125rem] text-muted">
              Guests are added in{" "}
              <Link
                href="/settings/guests"
                className="font-semibold text-accent hover:text-accent-strong"
              >
                Guests
              </Link>
              .
            </p>
            <SubmitButton>Save reminders</SubmitButton>
          </div>
        </Card>
      </form>
    </>
  );
}
