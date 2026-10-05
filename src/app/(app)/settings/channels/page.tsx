import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { Card } from "~/app/_components/card";
import { Field, FormActions, Notice, Select } from "~/app/_components/form";
import { formatPhone, localMobileDigits } from "~/lib/phone";
import { REMINDER_HOURS, formatReminderHour } from "~/lib/reminders";
import {
  sendTestEmail,
  updateChannelSettings,
} from "~/server/actions/settings";
import { getSession } from "~/server/better-auth/server";
import { getUserSettings } from "~/server/queries/settings";
import { SEND_HOUR } from "~/server/reminders/generate";

const SAVED_MESSAGES: Record<
  string,
  { tone: "success" | "error"; text: string }
> = {
  channels: { tone: "success", text: "Channels saved." },
  test: { tone: "success", text: "Test email sent — check your inbox." },
  "test-failed": {
    tone: "error",
    text: "Couldn't send the test email. Try again in a minute.",
  },
};

function StatusPill({
  tone,
  children,
}: {
  tone: "ok" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
        tone === "ok" ? "bg-ok-soft text-ok" : "bg-sunken-2 text-ink-2"
      }`}
    >
      {children}
    </span>
  );
}

function ChannelIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent [&_svg]:size-5.5">
      {children}
    </span>
  );
}

/** Settings › Channels: where reminders reach you, and when. */
export default async function ChannelSettingsPage({
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
  const message = saved ? SAVED_MESSAGES[saved] : undefined;

  return (
    <form
      action={updateChannelSettings}
      data-gtm-event="channels_updated"
      className="space-y-4"
    >
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <Card aria-labelledby="where">
        <div className="space-y-1 border-b border-line-soft px-5 py-4 sm:px-6">
          <h2 id="where" className="text-base font-semibold text-ink">
            Where reminders reach you
          </h2>
          <p className="text-[0.8125rem] text-muted">
            Choose a channel for each kind of payment in{" "}
            <Link
              href="/settings/reminders"
              className="font-semibold text-accent hover:text-accent-strong"
            >
              Reminders
            </Link>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-b border-line-soft px-5 py-5 sm:px-6">
          <ChannelIcon>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 7l9 6 9-6" />
            </svg>
          </ChannelIcon>
          <div className="min-w-0 flex-1 basis-56">
            <p className="text-[0.9375rem] font-semibold text-ink">Email</p>
            <p className="truncate text-[0.8125rem] text-muted">
              {user.email} · your sign-in email
            </p>
          </div>
          <StatusPill tone="ok">Verified</StatusPill>
          <Button
            formAction={sendTestEmail}
            formNoValidate
            variant="outline"
            size="sm"
          >
            Send a test
          </Button>
        </div>

        <div className="flex flex-wrap items-start gap-4 px-5 py-5 sm:px-6">
          <ChannelIcon>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="6" y="2" width="12" height="20" rx="2.5" />
              <path d="M10 18h4" />
            </svg>
          </ChannelIcon>
          <div className="min-w-0 flex-1 basis-64 space-y-3">
            <div>
              <p className="text-[0.9375rem] font-semibold text-ink">
                SMS &amp; WhatsApp
              </p>
              <p className="text-[0.8125rem] text-muted">
                {user.phone
                  ? `${formatPhone(user.phone)} — we'll verify it and start sending here as soon as SMS and WhatsApp launch.`
                  : "Add your mobile number now — we'll verify it and start sending here as soon as SMS and WhatsApp launch."}
              </p>
            </div>
            <Field label="Mobile number" optional className="max-w-xs">
              <span className="mt-1.5 flex overflow-hidden rounded-control border border-line-strong bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
                <span className="flex items-center border-r border-line bg-sunken px-3 text-[0.9375rem] text-muted">
                  +91
                </span>
                <input
                  name="mobile"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="98765 43210"
                  defaultValue={localMobileDigits(user.phone)}
                  className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-[0.9375rem] text-ink placeholder:text-muted/80 focus:ring-0 focus:outline-none"
                />
              </span>
            </Field>
          </div>
          <StatusPill tone="neutral">
            {user.phone ? "Coming soon" : "Not set up"}
          </StatusPill>
        </div>
      </Card>

      <Card aria-labelledby="delivery" className="space-y-5 p-5 sm:p-6">
        <div className="space-y-1">
          <h2 id="delivery" className="text-base font-semibold text-ink">
            Delivery
          </h2>
          <p className="text-[0.8125rem] text-muted">
            Times are in {user.timezone.replaceAll("_", " ")} ·{" "}
            <Link
              href="/settings"
              className="font-semibold text-accent hover:text-accent-strong"
            >
              change time zone
            </Link>
          </p>
        </div>
        <Field label="Send reminders at" className="max-w-xs">
          <Select
            name="reminderHour"
            defaultValue={String(user.reminderHour ?? SEND_HOUR)}
          >
            {REMINDER_HOURS.map((hour) => (
              <option key={hour} value={hour}>
                {formatReminderHour(hour)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-5">
          <div className="min-w-0 flex-1 basis-60">
            <p className="text-[0.9375rem] font-semibold text-ink">
              Weekly digest
            </p>
            <p className="text-[0.8125rem] text-muted">
              Every Monday: what&apos;s due and expected in the next 30 days.
            </p>
          </div>
          <StatusPill tone="neutral">Coming soon</StatusPill>
        </div>
      </Card>

      <FormActions>
        <Button type="submit">Save changes</Button>
      </FormActions>
    </form>
  );
}
