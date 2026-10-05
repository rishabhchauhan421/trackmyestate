import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { EmptyState } from "~/app/_components/empty-state";
import { InsuranceIcon } from "~/app/_components/icons";
import { PageHeader } from "~/app/_components/page-header";
import { StatusBadge } from "~/app/_components/status-badge";
import { formatDate, formatINR } from "~/lib/format";
import { POLICY_TYPE_LABELS } from "~/lib/labels";
import { getSession } from "~/server/better-auth/server";
import { getPolicies } from "~/server/queries/policies";

export default async function InsurancePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const policies = await getPolicies(session.user.id);

  return (
    <>
      <PageHeader
        title="Insurance"
        description="Life, health, vehicle and home policies — premiums, coverage, maturity and claims."
        action={<Button href="/insurance/new">Add policy</Button>}
      />

      {policies.length === 0 ? (
        <EmptyState
          Icon={InsuranceIcon}
          title="No policies yet"
          description="Add a policy to track premium due dates, sum assured, maturity payouts and claims — renewal reminders are set up automatically."
          actionLabel="Add your first policy"
          actionHref="/insurance/new"
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <ul className="divide-y divide-line-soft">
            {policies.map((policy) => {
              const nextPremium = policy.nextPremium;
              return (
                <li
                  key={policy.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">
                      {policy.insurer}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {POLICY_TYPE_LABELS[policy.type]} · {policy.policyNumber}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink">
                      {policy.sumAssured ? formatINR(policy.sumAssured) : "—"}
                    </p>
                    <p className="text-xs text-muted">sum assured</p>
                  </div>
                  {nextPremium ? (
                    <div className="text-right">
                      <p className="text-sm font-medium text-ink-2">
                        {formatINR(nextPremium.amount)}
                      </p>
                      <p className="text-xs text-muted">
                        due {formatDate(nextPremium.dueDate)}
                      </p>
                    </div>
                  ) : (
                    <span className="text-xs text-muted">No premium due</span>
                  )}
                  <StatusBadge status={policy.status} />
                  <Link
                    href={`/insurance/${policy.id}/edit`}
                    className="shrink-0 text-xs font-medium text-accent hover:text-accent-strong"
                  >
                    Edit →
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
