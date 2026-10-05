import { redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { Card } from "~/app/_components/card";
import { Notice } from "~/app/_components/form";
import { PlusIcon, ShieldIcon } from "~/app/_components/icons";
import { formatPhone } from "~/lib/phone";
import { reminderCategoryConfig } from "~/lib/reminders";
import { pauseGuest, removeGuest, resumeGuest } from "~/server/actions/guests";
import { getSession } from "~/server/better-auth/server";
import { getGuests } from "~/server/queries/guests";
import { getPropertyOptionsForOwner } from "~/server/queries/properties";

const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: "Email",
  WHATSAPP: "WhatsApp (coming soon)",
  SMS: "SMS (coming soon)",
  PUSH: "Push",
};

const SAVED_MESSAGES: Record<string, string> = {
  added: "Guest added — we've emailed them to let them know.",
  updated: "Guest updated.",
};

type GuestStatus = { label: string; className: string };

function statusOf(guest: {
  pausedAt: Date | null;
  optedOutAt: Date | null;
}): GuestStatus {
  if (guest.optedOutAt) {
    return {
      label: "Stopped reminders",
      className: "bg-danger-soft text-danger",
    };
  }
  if (guest.pausedAt) {
    return { label: "Paused", className: "bg-sunken-2 text-ink-2" };
  }
  return { label: "Active", className: "bg-ok-soft text-ok" };
}

/** Settings › Guests: people who get reminders without an account. */
export default async function GuestSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const [guests, properties, { saved }] = await Promise.all([
    getGuests(session.user.id),
    getPropertyOptionsForOwner(session.user.id),
    searchParams,
  ]);
  const propertyName = new Map(properties.map((p) => [p.id, p.name]));
  const savedMessage = saved ? SAVED_MESSAGES[saved] : undefined;

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl space-y-1">
          <h2 className="text-xl font-semibold text-ink">Guests</h2>
          <p className="text-sm leading-relaxed text-muted">
            People who get reminders about the things you choose. They
            don&apos;t sign up and never see your dashboard.
          </p>
        </div>
        <Button href="/settings/guests/new">
          <PlusIcon />
          Add guest
        </Button>
      </div>

      {savedMessage && <Notice tone="success">{savedMessage}</Notice>}

      <p className="flex gap-3 rounded-xl bg-accent-soft px-4 py-3.5 text-[0.8125rem] leading-relaxed text-accent-strong">
        <ShieldIcon className="mt-0.5 size-5 shrink-0" />A guest only ever sees
        the name, amount and due date of what you share with them — never your
        other assets, totals or documents. Every reminder has a link to stop.
      </p>

      {guests.length === 0 ? (
        <div className="rounded-card border-[1.5px] border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <p className="text-base font-semibold text-ink">No guests yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Add a family member for the utility bills, your tenant for rent, or
            your accountant for EMIs and premiums.
          </p>
        </div>
      ) : (
        guests.map((guest) => {
          const status = statusOf(guest);
          const kinds = guest.categories
            .map((category) => reminderCategoryConfig(category).label)
            .join(", ");
          const places = guest.propertyIds
            .map((id) => propertyName.get(id))
            .filter(Boolean)
            .join(", ");
          return (
            <Card
              key={guest.id}
              aria-label={guest.name}
              className={`space-y-4 p-5 sm:p-6 ${(guest.optedOutAt ?? guest.pausedAt) ? "opacity-85" : ""}`}
            >
              <div className="flex flex-wrap items-start gap-3.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[0.9375rem] font-semibold text-accent-strong">
                  {guest.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1 basis-52 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-ink">
                      {guest.name}
                    </h3>
                    {guest.relationship && (
                      <span className="rounded-full bg-sunken px-2 py-0.5 text-xs font-medium text-ink-2">
                        {guest.relationship}
                      </span>
                    )}
                  </div>
                  <p className="text-[0.8125rem] break-words text-muted">
                    {[guest.email, guest.phone && formatPhone(guest.phone)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}
                >
                  {status.label}
                </span>
              </div>

              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-[0.8125rem] sm:grid-cols-3">
                <div>
                  <dt className="text-muted">Reminded about</dt>
                  <dd className="mt-1 font-medium text-ink">
                    {kinds}
                    {places && <span className="text-ink-2"> · {places}</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">By</dt>
                  <dd className="mt-1 font-medium text-ink">
                    {guest.channels.map((c) => CHANNEL_LABELS[c]).join(", ")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">When</dt>
                  <dd className="mt-1 font-medium text-ink">
                    {guest.dueDayOnly
                      ? "Only on the due day"
                      : "Same schedule as yours"}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-4">
                {guest.optedOutAt ? (
                  <p className="mr-auto text-[0.8125rem] text-muted">
                    They used the stop link — only they can opt back in.
                  </p>
                ) : (
                  <>
                    <Button
                      href={`/settings/guests/${guest.id}/edit`}
                      variant="outline"
                      size="sm"
                    >
                      Edit
                    </Button>
                    <form>
                      {guest.pausedAt ? (
                        <Button
                          formAction={resumeGuest.bind(null, guest.id)}
                          size="sm"
                        >
                          Resume
                        </Button>
                      ) : (
                        <Button
                          formAction={pauseGuest.bind(null, guest.id)}
                          variant="outline"
                          size="sm"
                        >
                          Pause
                        </Button>
                      )}
                    </form>
                  </>
                )}
                <form className="ml-auto">
                  <button
                    formAction={removeGuest.bind(null, guest.id)}
                    className="h-9 rounded-control px-3 text-[0.8125rem] font-medium text-danger hover:bg-danger-soft"
                  >
                    Remove
                  </button>
                </form>
              </div>
            </Card>
          );
        })
      )}

      <Card
        aria-labelledby="preview"
        className="flex flex-wrap items-center gap-6 p-5 sm:p-6"
      >
        <div className="min-w-0 flex-1 basis-60 space-y-1.5">
          <h2 id="preview" className="text-base font-semibold text-ink">
            What a guest receives
          </h2>
          <p className="text-[0.8125rem] leading-relaxed text-muted">
            Sent in your name, at the same time as your own reminders.
          </p>
        </div>
        <div
          aria-hidden="true"
          className="w-full max-w-sm flex-1 basis-72 rounded-xl border border-line bg-sunken p-4 text-[0.8125rem] leading-relaxed text-ink"
        >
          <p className="font-semibold">
            Electricity bill: ₹4,120 due in 3 days
          </p>
          <p className="mt-1 text-ink-2">
            From {session.user.name}, via TrackMyEstate.
            <br />
            Electricity bill — ₹4,120, due on 8 Oct 2026.
          </p>
          <p className="mt-2 font-semibold text-accent">Stop these reminders</p>
        </div>
      </Card>
    </>
  );
}
