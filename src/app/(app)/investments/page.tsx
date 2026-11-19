import { Suspense } from "react";
import { ListSkeleton } from "~/app/_components/skeleton";
import Link from "next/link";
import { Button } from "~/app/_components/button";
import { EmptyState } from "~/app/_components/empty-state";
import { InvestmentsIcon } from "~/app/_components/icons";
import { PageHeader } from "~/app/_components/page-header";
import { formatMoney } from "~/lib/format";
import { INVESTMENT_TYPE_LABELS } from "~/lib/labels";
import { requireScope } from "~/server/households";
import { getUserCurrency } from "~/server/queries/settings";
import { getInvestments } from "~/server/queries/investments";

async function InvestmentsContent() {
  const scope = await requireScope();
  const [currency, investments] = await Promise.all([
    getUserCurrency(scope.userId),
    getInvestments(scope.householdId),
  ]);

  return (
    <>
      {investments.length === 0 ? (
        <EmptyState
          Icon={InvestmentsIcon}
          title="No investments yet"
          description="Add an investment to log its capital deployed, expected return and current estimated value."
          actionLabel="Add your first investment"
          actionHref="/investments/new"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {investments.map((investment) => {
            const gain =
              investment.currentEstimatedValue != null
                ? investment.currentEstimatedValue - investment.capitalDeployed
                : null;
            return (
              <div
                key={investment.id}
                className="rounded-card border border-line bg-surface p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-ink">
                    {investment.name}
                  </p>
                  <span className="shrink-0 rounded-full bg-sunken-2 px-2.5 py-1 text-xs font-medium text-ink-2">
                    {INVESTMENT_TYPE_LABELS[investment.type]}
                  </span>
                </div>
                <p className="mt-4 text-xl font-semibold text-ink">
                  {investment.currentEstimatedValue
                    ? formatMoney(
                        investment.currentEstimatedValue,
                        investment.currency ?? currency,
                      )
                    : formatMoney(
                        investment.capitalDeployed,
                        investment.currency ?? currency,
                      )}
                </p>
                <p className="text-xs text-muted">
                  {formatMoney(
                    investment.capitalDeployed,
                    investment.currency ?? currency,
                  )}{" "}
                  deployed
                  {gain != null && (
                    <span className={gain >= 0 ? "text-ok" : "text-danger"}>
                      {" "}
                      ({gain >= 0 ? "+" : ""}
                      {formatMoney(gain, investment.currency ?? currency)})
                    </span>
                  )}
                </p>
                <Link
                  href={`/investments/${investment.id}/edit`}
                  className="mt-4 inline-block text-xs font-medium text-accent hover:text-accent-strong"
                >
                  Edit →
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

/**
 * The header is the same for everyone, so it is prerendered and shows the
 * moment the page is opened; the data streams in beneath it.
 */
export default function InvestmentsPage() {
  return (
    <>
      <PageHeader
        title="Investments"
        description="FDs, mutual funds, stocks, gold and more — capital deployed alongside current value."
        action={<Button href="/investments/new">Add investment</Button>}
      />

      <Suspense fallback={<ListSkeleton />}>
        <InvestmentsContent />
      </Suspense>
    </>
  );
}
