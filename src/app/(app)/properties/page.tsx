import { EmptyState } from "~/app/_components/empty-state";
import { PropertiesIcon } from "~/app/_components/icons";
import { PageHeader } from "~/app/_components/page-header";

export default function PropertiesPage() {
  return (
    <>
      <PageHeader
        title="Properties"
        description="Every home, rental and investment property — with its rent, bills, tenants and paper trail."
        action={
          <button
            type="button"
            disabled
            title="Coming soon"
            className="cursor-not-allowed rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white opacity-40"
          >
            Add property
          </button>
        }
      />

      <EmptyState
        Icon={PropertiesIcon}
        title="No properties yet"
        description="Add a property to start tracking rent, utility bills, occupancy and the loan or insurance linked to it."
        actionLabel="Add your first property"
      />
    </>
  );
}
