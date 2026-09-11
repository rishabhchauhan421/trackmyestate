import { EmptyState } from "~/app/_components/empty-state";
import { InsuranceIcon } from "~/app/_components/icons";
import { PageHeader } from "~/app/_components/page-header";

export default function InsurancePage() {
  return (
    <>
      <PageHeader
        title="Insurance"
        description="Life, health, vehicle and home policies — premiums, coverage, maturity and claims."
        action={
          <button
            type="button"
            disabled
            title="Coming soon"
            className="cursor-not-allowed rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white opacity-40"
          >
            Add policy
          </button>
        }
      />

      <EmptyState
        Icon={InsuranceIcon}
        title="No policies yet"
        description="Add a policy to track premium due dates, sum assured, maturity payouts and claims — renewal reminders are set up automatically."
        actionLabel="Add your first policy"
      />
    </>
  );
}
