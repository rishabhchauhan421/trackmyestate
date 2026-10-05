import { redirect } from "next/navigation";

import { Breadcrumbs } from "~/app/_components/page-header";
import { createGuest } from "~/server/actions/guests";
import { getSession } from "~/server/better-auth/server";
import { getPropertyOptionsForOwner } from "~/server/queries/properties";
import { GuestForm } from "../guest-form";

export default async function NewGuestPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const properties = await getPropertyOptionsForOwner(session.user.id);

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Guests", href: "/settings/guests" },
          { label: "Add a guest" },
        ]}
      />
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-ink">Add a guest</h2>
        <p className="text-sm text-muted">
          They&apos;ll get reminders only — no account, no dashboard.
        </p>
      </div>
      <GuestForm
        action={createGuest}
        properties={properties}
        submitLabel="Add guest"
      />
    </>
  );
}
