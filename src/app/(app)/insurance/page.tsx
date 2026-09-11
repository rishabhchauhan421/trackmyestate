import { redirect } from "next/navigation";

import { EmptyState } from "~/app/_components/empty-state";
import { InsuranceIcon } from "~/app/_components/icons";
import { PageHeader } from "~/app/_components/page-header";
import { StatusBadge } from "~/app/_components/status-badge";
import { formatDate, formatINR } from "~/lib/format";
import { getSession } from "~/server/better-auth/server";
import { getPolicies } from "~/server/queries";

const TYPE_LABELS: Record<string, string> = {
  TERM_LIFE: "Term life",
  ENDOWMENT: "Endowment",
  MONEY_BACK: "Money back",
  ULIP: "ULIP",
  HEALTH: "Health",
  VEHICLE: "Vehicle",
  HOME: "Home",
};

export default async function InsurancePage() {
  const session = await getSession();
  if (!session) redirect("/");
  const policies = await getPolicies(session.user.id);

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

      {policies.length === 0 ? (
        <EmptyState
          Icon={InsuranceIcon}
          title="No policies yet"
          description="Add a policy to track premium due dates, sum assured, maturity payouts and claims — renewal reminders are set up automatically."
          actionLabel="Add your first policy"
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {policies.map((policy) => {
              const nextPremium = policy.nextPremium;
              return (
                <li
                  key={policy.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {policy.insurer}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {TYPE_LABELS[policy.type]} · {policy.policyNumber}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {policy.sumAssured ? formatINR(policy.sumAssured) : "—"}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      sum assured
                    </p>
                  </div>
                  {nextPremium ? (
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {formatINR(nextPremium.amount)}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        due {formatDate(nextPremium.dueDate)}
                      </p>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      No premium due
                    </span>
                  )}
                  <StatusBadge status={policy.status} />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
