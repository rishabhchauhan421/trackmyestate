import { redirect } from "next/navigation";

import { PageHeader } from "~/app/_components/page-header";
import { getSession } from "~/server/better-auth/server";
import { getGuests } from "~/server/queries/guests";
import { SettingsNav } from "./settings-nav";

/** Shared frame for every Settings tab: the header and the sub-navigation. */
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const guests = await getGuests(session.user.id);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your profile, how and when you're reminded, and who else gets reminders."
      />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <SettingsNav guestCount={guests.length} />
        <div className="min-w-0 flex-1 space-y-4">{children}</div>
      </div>
    </>
  );
}
