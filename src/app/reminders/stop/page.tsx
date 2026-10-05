import { type Metadata } from "next";

import { Button } from "~/app/_components/button";
import { Notice } from "~/app/_components/form";
import { SlimLayout } from "~/app/_components/slim-layout";
import { stopGuestReminders } from "~/server/actions/guest-opt-out";
import { db } from "~/server/db";
import { verifyGuestOptOut } from "~/server/guests/opt-out";

export const metadata: Metadata = {
  title: "Stop reminders",
  robots: { index: false, follow: false },
};

/**
 * Where the "stop these reminders" link in a guest email lands. It asks
 * for a click instead of stopping on load, so email scanners that open
 * links automatically can't unsubscribe someone by accident.
 */
export default async function StopRemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ guest?: string; sig?: string; done?: string }>;
}) {
  const { guest: guestId = "", sig = "", done } = await searchParams;
  const guest =
    guestId && sig && verifyGuestOptOut(guestId, sig)
      ? await db.guest.findUnique({
          where: { id: guestId },
          select: {
            name: true,
            optedOutAt: true,
            owner: { select: { name: true } },
          },
        })
      : null;

  if (!guest) {
    return (
      <SlimLayout title="This link isn't valid">
        <Notice tone="error">
          We couldn&apos;t find the reminders this link is for. If you keep
          getting reminders you don&apos;t want, reply to one of them and
          we&apos;ll stop them.
        </Notice>
      </SlimLayout>
    );
  }

  if (done || guest.optedOutAt) {
    return (
      <SlimLayout title="Reminders stopped">
        <Notice tone="success">
          You won&apos;t get any more reminders from {guest.owner.name} through
          TrackMyEstate.
        </Notice>
      </SlimLayout>
    );
  }

  return (
    <SlimLayout
      title="Stop these reminders?"
      description={`${guest.owner.name} added you, ${guest.name}, to get reminders about some of their payments.`}
    >
      <form action={stopGuestReminders.bind(null, guestId, sig)}>
        <Button type="submit" size="lg" className="w-full">
          Stop all reminders from {guest.owner.name}
        </Button>
      </form>
      <p className="text-sm text-muted">
        Changed your mind? Ask {guest.owner.name} to add you again.
      </p>
    </SlimLayout>
  );
}
