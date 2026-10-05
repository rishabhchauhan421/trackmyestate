import { notFound, redirect } from "next/navigation";

import { Breadcrumbs } from "~/app/_components/page-header";
import { updateGuest } from "~/server/actions/guests";
import { getSession } from "~/server/better-auth/server";
import { getGuestForOwner } from "~/server/queries/guests";
import { getPropertyOptionsForOwner } from "~/server/queries/properties";
import { GuestForm } from "../../guest-form";

export default async function EditGuestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const [guest, properties] = await Promise.all([
    getGuestForOwner(id, session.user.id),
    getPropertyOptionsForOwner(session.user.id),
  ]);
  if (!guest || guest.optedOutAt) notFound();

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Guests", href: "/settings/guests" },
          { label: guest.name },
        ]}
      />
      <h2 className="text-xl font-semibold text-ink">Edit {guest.name}</h2>
      <GuestForm
        action={updateGuest.bind(null, guest.id)}
        guest={guest}
        properties={properties}
        submitLabel="Save changes"
      />
    </>
  );
}
