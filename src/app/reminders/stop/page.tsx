import { Suspense } from "react";
import { type Metadata } from "next";

import { SubmitButton } from "~/app/_components/submit-button";
import { Notice } from "~/app/_components/form";
import { SlimLayout } from "~/app/_components/slim-layout";
import { SlimLayoutSkeleton } from "~/app/_components/skeleton";
import { stopReminders, type StopLink } from "~/server/actions/guest-opt-out";
import { db } from "~/server/db";
import {
  verifyGuestOptOut,
  verifyRecipientOptOut,
} from "~/server/guests/opt-out";

export const metadata: Metadata = {
  title: "Stop reminders",
  robots: { index: false, follow: false },
};

/**
 * Who a signed stop link is for: a guest (`guest`), or a utility's
 * recipient (`owner` + `email`). Null when the link isn't valid.
 */
async function resolveLink(params: {
  guest?: string;
  owner?: string;
  email?: string;
  sig?: string;
}): Promise<{
  link: StopLink;
  ownerName: string;
  stopped: boolean;
  greeting: string;
} | null> {
  const { guest: guestId, owner: ownerId, email, sig } = params;
  if (!sig) return null;

  if (guestId && verifyGuestOptOut(guestId, sig)) {
    const guest = await db.guest.findUnique({
      where: { id: guestId },
      select: {
        name: true,
        optedOutAt: true,
        owner: { select: { name: true } },
      },
    });
    if (!guest) return null;
    return {
      link: { guest: guestId, sig },
      ownerName: guest.owner.name,
      stopped: Boolean(guest.optedOutAt),
      greeting: `${guest.owner.name} added you, ${guest.name}, to get reminders about some of their payments.`,
    };
  }

  if (ownerId && email && verifyRecipientOptOut(ownerId, email, sig)) {
    const owner = await db.user.findUnique({
      where: { id: ownerId },
      select: { name: true },
    });
    if (!owner) return null;
    const stopped = await db.emailSuppression.findUnique({
      where: { key: `${ownerId}:${email.trim().toLowerCase()}` },
      select: { id: true },
    });
    return {
      link: { owner: ownerId, email, sig },
      ownerName: owner.name,
      stopped: stopped !== null,
      greeting: `${owner.name} added ${email} to get reminders about one of their bills.`,
    };
  }

  return null;
}

/**
 * Where the "stop these reminders" link in an email sent on a user's
 * behalf lands. It asks for a click instead of stopping on load, so email
 * scanners that open links automatically can't unsubscribe someone by
 * accident.
 */
async function StopRemindersPageContent({
  searchParams,
}: {
  searchParams: Promise<{
    guest?: string;
    owner?: string;
    email?: string;
    sig?: string;
    done?: string;
  }>;
}) {
  const params = await searchParams;
  const resolved = await resolveLink(params);

  if (!resolved) {
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

  const { link, ownerName, stopped, greeting } = resolved;

  if (params.done === "all") {
    return (
      <SlimLayout title="All reminders stopped">
        <Notice tone="success">
          Nobody on TrackMyEstate can send you reminders any more.
        </Notice>
      </SlimLayout>
    );
  }

  if (params.done || stopped) {
    return (
      <SlimLayout title="Reminders stopped">
        <Notice tone="success">
          You won&apos;t get any more reminders from {ownerName} through
          TrackMyEstate.
        </Notice>
        <form action={stopReminders.bind(null, link, true)}>
          <SubmitButton variant="outline" className="w-full">
            Also stop reminders from anyone else on TrackMyEstate
          </SubmitButton>
        </form>
      </SlimLayout>
    );
  }

  return (
    <SlimLayout title="Stop these reminders?" description={greeting}>
      <form action={stopReminders.bind(null, link, false)}>
        <SubmitButton size="lg" className="w-full">
          Stop all reminders from {ownerName}
        </SubmitButton>
      </form>
      <form action={stopReminders.bind(null, link, true)}>
        <SubmitButton variant="outline" className="w-full">
          Stop reminders from anyone on TrackMyEstate
        </SubmitButton>
      </form>
      <p className="text-sm text-muted">
        Changed your mind? Ask {ownerName} to add you again.
      </p>
    </SlimLayout>
  );
}

/**
 * What this page shows depends on the address it was opened with, so the
 * frame and title are prerendered and the rest streams in behind them.
 */
export default function StopRemindersPage(
  props: Parameters<typeof StopRemindersPageContent>[0],
) {
  return (
    <>
      <Suspense fallback={<SlimLayoutSkeleton title="Stop reminders" />}>
        <StopRemindersPageContent {...props} />
      </Suspense>
    </>
  );
}
