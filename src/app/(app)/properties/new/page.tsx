import { redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { FormActions } from "~/app/_components/form";
import { PageHeader } from "~/app/_components/page-header";
import { createProperty } from "~/server/actions/properties";
import { getSession } from "~/server/better-auth/server";
import { PropertyFormFields } from "../_components/property-form-fields";

export default async function NewPropertyPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Properties", href: "/properties" },
          { label: "Add property" },
        ]}
        title="Add a property"
        description="Only the name, how it's used and the address are required. You can fill in the rest any time."
      />

      <div className="flex flex-col-reverse gap-6 lg:flex-row lg:items-start">
        <form
          action={createProperty}
          data-gtm-event="property_created"
          className="min-w-0 flex-1 space-y-4"
        >
          <PropertyFormFields />
          <FormActions>
            <Button href="/properties" variant="outline">
              Cancel
            </Button>
            <Button type="submit">Save property</Button>
          </FormActions>
        </form>

        <aside className="rounded-card border border-line bg-surface p-5 lg:w-72">
          <h2 className="text-sm font-semibold text-ink">After you save</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-4.5 text-[0.8125rem] leading-relaxed text-ink-2">
            <li>Add a lease to start tracking rent</li>
            <li>Add utilities to get bill reminders</li>
            <li>Link the home loan, if there is one</li>
          </ul>
        </aside>
      </div>
    </>
  );
}
