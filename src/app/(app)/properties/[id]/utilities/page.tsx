import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { EmptyState } from "~/app/_components/empty-state";
import { PropertiesIcon } from "~/app/_components/icons";
import { PageHeader, propertyCrumbs } from "~/app/_components/page-header";
import { StatusBadge } from "~/app/_components/status-badge";
import { formatBillAmount, formatDate } from "~/lib/format";
import { BILL_TYPE_LABELS, UTILITY_RECURRENCE_LABELS } from "~/lib/labels";
import {
  addUtilityRecipient,
  deactivateUtility,
  removeUtilityRecipient,
} from "~/server/actions/utilities";
import { getSession } from "~/server/better-auth/server";
import { getPropertyForOwner } from "~/server/queries/properties";
import {
  getActiveUtilitiesForProperty,
  getUtilityBillsForProperty,
} from "~/server/queries/utilities";

export default async function PropertyUtilitiesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
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
      <PageHeader
        breadcrumbs={[...propertyCrumbs(property), { label: "Utilities" }]}
        title={`${property.name} — Utilities`}
        description="Recurring bill schedules and who gets notified when they're due. Bills themselves are generated automatically."
        action={
          <Button href={`/properties/${id}/utilities/new`}>Add utility</Button>
        }
      />

      {utilities.length === 0 && bills.length === 0 ? (
        <EmptyState
          Icon={PropertiesIcon}
          title="No utilities tracked yet"
          description="Add a utility to set up a recurring bill schedule and who should be notified when it's due."
          actionLabel="Add your first utility"
          actionHref={`/properties/${id}/utilities/new`}
        />
      ) : (
        <>
          <div>
            <h2 className="mb-3 text-sm font-semibold text-ink">
              Active utilities
            </h2>
            {utilities.length === 0 ? (
              <p className="text-sm text-muted">No active utility schedules.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {utilities.map((utility) => (
                  <div
                    key={utility.id}
                    className="rounded-card border border-line bg-surface p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          {utility.provider
                            ? `${utility.provider} · ${BILL_TYPE_LABELS[utility.type]}`
                            : BILL_TYPE_LABELS[utility.type]}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {UTILITY_RECURRENCE_LABELS[utility.recurrence]}
                          {utility.defaultAmount != null && (
                            <>
                              {" "}
                              ·{" "}
                              {formatBillAmount(
                                utility.defaultAmount,
                                utility.billingType === "VARIABLE",
                              )}
                            </>
                          )}
                          {utility.accountNumber && (
                            <> · A/C {utility.accountNumber}</>
                          )}
                        </p>
                      </div>
                      <form data-gtm-event="utility_deactivated">
                        <button
                          formAction={deactivateUtility.bind(null, utility.id)}
                          className="shrink-0 rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-muted transition hover:border-danger/30 hover:text-danger"
                        >
                          Deactivate
                        </button>
                      </form>
                    </div>

                    <div className="mt-4 border-t border-line-soft pt-3">
                      <p className="text-xs font-medium text-ink-2">Notify</p>

                      {utility.recipients.length > 0 && (
                        <ul className="mt-1.5 space-y-1">
                          {utility.recipients.map((recipient) => (
                            <li
                              key={recipient.email}
                              className="flex items-center justify-between gap-2 text-xs text-ink-2"
                            >
                              <span className="truncate">
                                {recipient.name} · {recipient.email}
                              </span>
                              <form data-gtm-event="utility_recipient_removed">
                                <button
                                  formAction={removeUtilityRecipient.bind(
                                    null,
                                    utility.id,
                                    recipient.email,
                                  )}
                                  className="shrink-0 text-muted hover:text-danger"
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
                        data-gtm-event="utility_recipient_added"
                        className="mt-2 flex flex-wrap gap-2"
                      >
                        <input
                          type="text"
                          name="name"
                          required
                          placeholder="Name"
                          className="min-w-0 flex-1 rounded-lg border border-line px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
                        />
                        <input
                          type="email"
                          name="email"
                          required
                          placeholder="email@example.com"
                          className="min-w-0 flex-2 rounded-lg border border-line px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
                        />
                        <input type="hidden" name="notifyOnDue" value="on" />
                        <button
                          type="submit"
                          className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-2 transition hover:bg-sunken"
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
            <h2 className="mb-3 text-sm font-semibold text-ink">
              Generated bills
            </h2>
            {bills.length === 0 ? (
              <p className="text-sm text-muted">
                No bills generated yet — they appear here automatically on the
                date of each cycle&apos;s first reminder.
              </p>
            ) : (
              <div className="overflow-hidden rounded-card border border-line bg-surface">
                <ul className="divide-y divide-line-soft">
                  {bills.map((bill) => (
                    <li key={bill.id}>
                      <Link
                        href={`/properties/${id}/utilities/bills/${bill.id}`}
                        className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-sunken"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">
                            {bill.utility.provider
                              ? `${bill.utility.provider} · ${BILL_TYPE_LABELS[bill.utility.type]}`
                              : BILL_TYPE_LABELS[bill.utility.type]}
                          </p>
                          <p className="mt-0.5 text-xs text-muted">
                            {formatBillAmount(
                              bill.amount,
                              bill.utility.billingType === "VARIABLE" &&
                                bill.status !== "PAID",
                            )}{" "}
                            · due {formatDate(bill.dueDate)}
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
