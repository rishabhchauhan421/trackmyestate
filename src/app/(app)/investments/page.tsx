import { EmptyState } from "~/app/_components/empty-state";
import { InvestmentsIcon } from "~/app/_components/icons";
import { PageHeader } from "~/app/_components/page-header";

export default function InvestmentsPage() {
  return (
    <>
      <PageHeader
        title="Investments & Loans"
        description="FDs, mutual funds, stocks and gold alongside loans and EMIs, with amortization built in."
        action={
          <button
            type="button"
            disabled
            title="Coming soon"
            className="cursor-not-allowed rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white opacity-40"
          >
            Add investment or loan
          </button>
        }
      />

      <EmptyState
        Icon={InvestmentsIcon}
        title="Nothing tracked yet"
        description="Add an investment to log expected returns, or a loan to get an auto-generated EMI and amortization schedule feeding your timeline."
        actionLabel="Add your first entry"
      />
    </>
  );
}
