import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyState } from "~/app/_components/empty-state";
import { PropertiesIcon } from "~/app/_components/icons";
import { PageHeader } from "~/app/_components/page-header";
import { formatINR } from "~/lib/format";
import { getSession } from "~/server/better-auth/server";
import { getProperties } from "~/server/queries";

const TYPE_LABELS: Record<string, string> = {
  SELF_OCCUPIED: "Self-occupied",
  RENTED: "Rented",
  UNDER_CONSTRUCTION: "Under construction",
  INVESTMENT: "Investment",
};

export default async function PropertiesPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const properties = await getProperties(session.user.id);

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

      {properties.length === 0 ? (
        <EmptyState
          Icon={PropertiesIcon}
          title="No properties yet"
          description="Add a property to start tracking rent, utility bills, occupancy and the loan or insurance linked to it."
          actionLabel="Add your first property"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => {
            const tenant = property.tenants[0];
            const dueBill = property.utilityBills[0];
            return (
              <div
                key={property.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {property.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {property.city}, {property.state}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {TYPE_LABELS[property.type]}
                  </span>
                </div>

                <p className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-50">
                  {property.currentEstimatedValue
                    ? formatINR(property.currentEstimatedValue)
                    : "—"}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Current estimated value
                </p>

                {tenant && (
                  <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                    Rented to{" "}
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {tenant.name}
                    </span>{" "}
                    · {formatINR(tenant.rentAmount)}/mo
                  </p>
                )}
                {dueBill && (
                  <p
                    className={`mt-1 text-xs font-medium ${
                      dueBill.status === "OVERDUE"
                        ? "text-red-600 dark:text-red-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {dueBill.status === "OVERDUE" ? "Overdue" : "Due"}:{" "}
                    {formatINR(dueBill.amount)} bill
                  </p>
                )}

                <Link
                  href={`/properties/${property.id}/utilities`}
                  className="mt-4 inline-block text-xs font-medium text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                >
                  Utilities →
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
