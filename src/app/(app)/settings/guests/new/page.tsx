import { Breadcrumbs } from "~/app/_components/page-header";
import { createGuestForm } from "~/server/actions/guests";
import { requireScope } from "~/server/households";
import { getPropertyOptionsForHousehold } from "~/server/queries/properties";
import { GuestForm } from "../guest-form";

export default async function NewGuestPage() {
  const scope = await requireScope();
  const properties = await getPropertyOptionsForHousehold(scope.householdId);

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
        action={createGuestForm}
        properties={properties}
        submitLabel="Add guest"
      />
    </>
  );
}
