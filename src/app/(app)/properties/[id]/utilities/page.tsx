import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { EmptyState } from "~/app/_components/empty-state";
import { PropertiesIcon } from "~/app/_components/icons";
import { PageHeader } from "~/app/_components/page-header";
import { StatusBadge } from "~/app/_components/status-badge";
import { formatDate, formatINR } from "~/lib/format";
import { BILL_TYPE_LABELS, UTILITY_RECURRENCE_LABELS } from "~/lib/labels";
import {
  addUtilityRecipient,
  deactivateUtility,
  removeUtilityRecipient,
} from "~/server/actions/utilities";
import { getSession } from "~/server/better-auth/server";
import {
  getActiveUtilitiesForProperty,
  getPropertyForOwner,
  getUtilityBillsForProperty,
} from "~/server/queries";

export default async function PropertyUtilitiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/");
  const property = await getPropertyForOwner(id, session.user.id);
  if (!property) {
    notFound();
  }

  const [utilities, bills] = await Promise.all([
    getActiveUtilitiesForProperty(id),
    getUtilityBillsForProperty(id),
  ]);

  return (
    <>
      <div>
        <Link
          href="/properties"
          className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          ← Properties
        </Link>
      </div>

      <PageHeader
        title={`${property.name} — Utilities`}
        description="Recurring bill schedules and who gets notified when they're due. Bills themselves are generated automatically."
        action={
          <Link
            href={`/properties/${id}/utilities/new`}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500"
          >
            Add utility
          </Link>
        }
      />

      {utilities.length === 0 && bills.length === 0 ? (
        <EmptyState
          Icon={PropertiesIcon}
          title="No utilities tracked yet"
          description="Add a utility to set up a recurring bill schedule and who should be notified when it's due."
          actionLabel="Add your first utility"
        />
      ) : (
        <>
          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
              Active utilities
            </h2>
            {utilities.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No active utility schedules.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {utilities.map((utility) => (
                  <div
                    key={utility.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                          {utility.provider
                            ? `${utility.provider} · ${BILL_TYPE_LABELS[utility.type]}`
                            : BILL_TYPE_LABELS[utility.type]}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {UTILITY_RECURRENCE_LABELS[utility.recurrence]}
                          {utility.defaultAmount != null && (
                            <> · {formatINR(utility.defaultAmount)}</>
                          )}
                          {utility.accountNumber && (
                            <> · A/C {utility.accountNumber}</>
                          )}
                        </p>
                      </div>
                      <form>
                        <button
                          formAction={deactivateUtility.bind(null, utility.id)}
                          className="shrink-0 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:border-red-200 hover:text-red-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-red-900 dark:hover:text-red-400"
                        >
                          Deactivate
                        </button>
                      </form>
                    </div>

                    <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        Notify
                      </p>

                      {utility.recipients.length > 0 && (
                        <ul className="mt-1.5 space-y-1">
                          {utility.recipients.map((recipient) => (
                            <li
                              key={recipient.id}
                              className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300"
                            >
                              <span className="truncate">
                                {recipient.name} · {recipient.email}
                              </span>
                              <form>
                                <button
                                  formAction={removeUtilityRecipient.bind(
                                    null,
                                    recipient.id,
                                  )}
                                  className="shrink-0 text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400"
                                  title="Remove"
                                >
                                  Remove
                                </button>
                              </form>
                            </li>
                          ))}
                        </ul>
                      )}

                      <form
                        action={addUtilityRecipient.bind(null, utility.id)}
                        className="mt-2 flex flex-wrap gap-2"
                      >
                        <input
                          type="text"
                          name="name"
                          required
                          placeholder="Name"
                          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-emerald-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                        <input
                          type="email"
                          name="email"
                          required
                          placeholder="email@example.com"
                          className="min-w-0 flex-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-emerald-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                        <input type="hidden" name="notifyOnDue" value="on" />
                        <button
                          type="submit"
                          className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          Add
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
              Generated bills
            </h2>
            {bills.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No bills generated yet — they appear here automatically on
                the date of each cycle&apos;s first reminder.
              </p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {bills.map((bill) => (
                    <li key={bill.id}>
                      <Link
                        href={`/properties/${id}/utilities/bills/${bill.id}`}
                        className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                            {bill.utility.provider
                              ? `${bill.utility.provider} · ${BILL_TYPE_LABELS[bill.utility.type]}`
                              : BILL_TYPE_LABELS[bill.utility.type]}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {formatINR(bill.amount)} · due{" "}
                            {formatDate(bill.dueDate)}
                          </p>
                        </div>
                        <StatusBadge status={bill.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
