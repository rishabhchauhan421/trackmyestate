import { notFound } from "next/navigation";

import { Breadcrumbs } from "~/app/_components/page-header";
import { updateGuestForm } from "~/server/actions/guests";
import { requireScope } from "~/server/households";
import { getGuestForOwner } from "~/server/queries/guests";
import { getPropertyOptionsForHousehold } from "~/server/queries/properties";
import { GuestForm } from "../../guest-form";

export default async function EditGuestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scope = await requireScope();
  const [guest, properties] = await Promise.all([
    getGuestForOwner(id, scope.userId),
    getPropertyOptionsForHousehold(scope.householdId),
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
        action={updateGuestForm.bind(null, guest.id)}
        guest={guest}
        properties={properties}
        submitLabel="Save changes"
      />
    </>
  );
}
