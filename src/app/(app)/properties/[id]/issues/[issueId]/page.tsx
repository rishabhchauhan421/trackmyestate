import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionForm } from "~/app/_components/action-form";
import { Button } from "~/app/_components/button";
import { Card, CardHeader, StatCard } from "~/app/_components/card";
import { Field, Input, controlClass } from "~/app/_components/form";
import { PageHeader, propertyCrumbs } from "~/app/_components/page-header";
import { StatusBadge } from "~/app/_components/status-badge";
import { SubmitButton } from "~/app/_components/submit-button";
import { dateOnly } from "~/lib/calendar-day";
import { daysUntil, formatDate, formatMoney } from "~/lib/format";
import { nextKeyDate } from "~/lib/issues";
import { ISSUE_TYPE_LABELS } from "~/lib/labels";
import { todayInTimeZone } from "~/lib/time-zone";
import {
  addIssueNoteForm,
  addKeyDateForm,
  removeKeyDate,
  reopenIssue,
  setKeyDateDone,
} from "~/server/actions/issues";
import { requireScope } from "~/server/households";
import { getIssueForHousehold } from "~/server/queries/issues";
import { getUserCurrency, getUserTimeZone } from "~/server/queries/settings";

/** "In 5 days" / "Today" / "3 days ago" for a key date. */
function formatWhen(days: number) {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `In ${days} days`;
  return `${-days} ${days === -1 ? "day" : "days"} ago`;
}

export default async function IssuePage({
  params,
}: {
  params: Promise<{ id: string; issueId: string }>;
}) {
  const [{ id, issueId }, scope] = await Promise.all([params, requireScope()]);
  const [issue, timeZone, userCurrency] = await Promise.all([
    getIssueForHousehold(issueId, scope.householdId),
    getUserTimeZone(scope.userId),
    getUserCurrency(scope.userId),
  ]);
  if (issue?.propertyId !== id) notFound();

  const base = `/properties/${id}/issues/${issue.id}`;
  const open = issue.status === "OPEN";
  const currency = issue.property.currency ?? userCurrency;
  const money = (amount: number) => formatMoney(amount, currency);
  const now = new Date();
  const today = dateOnly(todayInTimeZone(timeZone, now));

  const keyDates = [...issue.keyDates].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
  const next = nextKeyDate(keyDates, today);
  // The latest date that passed without being ticked, with nothing set
  // after it: what the "Finalise this?" email is about.
  const awaiting =
    open && !next
      ? keyDates
          .filter((keyDate) => !keyDate.done && keyDate.date < today)
          .at(-1)
      : undefined;
  const notes = [...issue.notes].sort(
    (a, b) => b.at.getTime() - a.at.getTime(),
  );
  const paid = issue.bills.reduce(
    (sum, bill) =>
      sum +
      (bill.status === "PAID"
        ? (bill.paidAmount ?? bill.amount)
        : bill.status === "PARTIALLY_PAID"
          ? (bill.paidAmount ?? 0)
          : 0),
    0,
  );

  return (
    <>
      <PageHeader
        breadcrumbs={[
          ...propertyCrumbs(issue.property),
          { label: issue.title },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {issue.title}
            <StatusBadge status={issue.status} />
          </span>
        }
        description={[
          ISSUE_TYPE_LABELS[issue.type],
          issue.counterparty && `with ${issue.counterparty}`,
          issue.reference && `ref. ${issue.reference}`,
          `since ${formatDate(issue.openedOn)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        action={
          open ? (
            <>
              <Button href={`${base}/edit`} variant="outline">
                Edit
              </Button>
              <Button href={`${base}/resolve`}>Mark resolved</Button>
            </>
          ) : (
            <form action={reopenIssue.bind(null, issue.id)}>
              <SubmitButton variant="outline">Reopen</SubmitButton>
            </form>
          )
        }
      />

      {awaiting && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-warn/30 bg-warn-soft px-5 py-4"
        >
          <p className="text-sm text-ink">
            <span className="font-semibold">{awaiting.label}</span> was on{" "}
            {formatDate(awaiting.date)}. Is this issue finalised? If not, add
            the next date below.
          </p>
          <Button href={`${base}/resolve`} size="sm">
            Mark resolved
          </Button>
        </div>
      )}

      {!open && (
        <Card className="space-y-1.5 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-ink">
            {issue.status === "RESOLVED" ? "Resolved" : "Dropped"}
            {issue.resolvedOn && ` on ${formatDate(issue.resolvedOn)}`}
          </h2>
          <p className="text-sm whitespace-pre-line text-muted">
            {issue.outcome ?? "No outcome was recorded."}
          </p>
        </Card>
      )}

      <section
        aria-label="Key figures"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <StatCard
          label="Next date"
          value={next ? formatDate(next.date) : "—"}
          hint={
            next
              ? `${next.label} · ${formatWhen(daysUntil(next.date, now, timeZone))}`
              : open
                ? "Nothing scheduled"
                : undefined
          }
        />
        <StatCard
          label="Still to pay"
          value={money(issue.owed)}
          hint={issue.owed > 0 ? undefined : "Nothing outstanding"}
        />
        <StatCard label="Paid so far" value={money(paid)} />
      </section>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card aria-labelledby="payments">
            <CardHeader
              title={<span id="payments">Payments</span>}
              action={
                open && (
                  <Link
                    href={`/properties/${id}/dues/new?issueId=${issue.id}`}
                    className="hover:text-accent-strong"
                  >
                    Add payment
                  </Link>
                )
              }
            />
            {issue.bills.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted">
                No payments under this issue. Add one payment, or a plan of
                instalments, and you&apos;ll be reminded before each is due.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-136 text-sm">
                  <thead>
                    <tr className="bg-sunken text-left text-xs text-muted">
                      <th scope="col" className="px-6 py-2.5 font-semibold">
                        Payment
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">
                        Due
                      </th>
                      <th scope="col" className="px-3 py-2.5 font-semibold">
                        Status
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-2.5 text-right font-semibold"
                      >
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {issue.bills.map((bill) => (
                      <tr key={bill.id}>
                        <td className="px-6 py-3.5">
                          <Link
                            href={`/bills/${bill.id}`}
                            className="font-medium text-ink hover:text-accent-strong"
                          >
                            {bill.description ?? "Payment"}
                          </Link>
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap text-muted">
                          {formatDate(bill.dueDate)}
                        </td>
                        <td className="px-3 py-3.5">
                          <StatusBadge status={bill.status} />
                        </td>
                        <td className="px-6 py-3.5 text-right font-semibold whitespace-nowrap text-ink">
                          {bill.direction === "INFLOW" && "+"}
                          {money(bill.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card aria-labelledby="notes">
            <CardHeader title={<span id="notes">Notes</span>} />
            <ActionForm
              action={addIssueNoteForm.bind(null, issue.id)}
              className="space-y-3 border-b border-line-soft px-5 py-4 sm:px-6"
            >
              <label className="block">
                <span className="sr-only">Add a note</span>
                <textarea
                  name="text"
                  rows={2}
                  required
                  placeholder="What happened? e.g. Hearing adjourned, reply filed."
                  className={controlClass}
                />
              </label>
              <div className="flex justify-end">
                <SubmitButton size="sm">Add note</SubmitButton>
              </div>
            </ActionForm>
            {notes.length === 0 ? (
              <p className="px-6 py-6 text-sm text-muted">
                Nothing logged yet. Notes keep the history of the issue readable
                later.
              </p>
            ) : (
              <ol className="divide-y divide-line-soft">
                {notes.map((note) => (
                  <li key={note.id} className="px-5 py-4 sm:px-6">
                    <p className="text-xs text-muted">
                      {formatDate(note.at, timeZone)} · {note.authorName}
                    </p>
                    <p className="mt-1 text-sm whitespace-pre-line text-ink">
                      {note.text}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card aria-labelledby="key-dates">
            <CardHeader title={<span id="key-dates">Key dates</span>} />
            {keyDates.length === 0 ? (
              <p className="px-6 py-6 text-sm text-muted">
                No dates yet. Add a hearing, a deadline or an expected decision
                to be reminded of it.
              </p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {keyDates.map((keyDate) => (
                  <li
                    key={keyDate.id}
                    className="flex items-start justify-between gap-3 px-5 py-3.5 sm:px-6"
                  >
                    <div className="min-w-0">
                      <p
                        className={
                          keyDate.done
                            ? "text-sm text-muted line-through"
                            : "text-sm font-medium text-ink"
                        }
                      >
                        {keyDate.label}
                      </p>
                      <p className="text-xs text-muted">
                        {formatDate(keyDate.date)}
                        {!keyDate.done &&
                          ` · ${formatWhen(daysUntil(keyDate.date, now, timeZone))}`}
                      </p>
                    </div>
                    {open && (
                      <div className="flex shrink-0 gap-2">
                        <form
                          action={setKeyDateDone.bind(
                            null,
                            issue.id,
                            keyDate.id,
                            !keyDate.done,
                          )}
                        >
                          <SubmitButton size="sm" variant="outline">
                            {keyDate.done ? "Undo" : "Done"}
                          </SubmitButton>
                        </form>
                        <form
                          action={removeKeyDate.bind(
                            null,
                            issue.id,
                            keyDate.id,
                          )}
                        >
                          <SubmitButton
                            size="sm"
                            variant="outline"
                            color="red"
                            aria-label={`Remove ${keyDate.label}`}
                          >
                            Remove
                          </SubmitButton>
                        </form>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {open && (
              <ActionForm
                action={addKeyDateForm.bind(null, issue.id)}
                className="space-y-4 border-t border-line-soft px-5 py-4 sm:px-6"
              >
                <Field label="Add a date">
                  <Input
                    name="label"
                    required
                    placeholder="e.g. Next hearing"
                  />
                </Field>
                <Field label="On">
                  <Input type="date" name="date" required />
                </Field>
                <div className="flex justify-end">
                  <SubmitButton size="sm" variant="outline">
                    Add date
                  </SubmitButton>
                </div>
              </ActionForm>
            )}
          </Card>

          {issue.description && (
            <Card className="space-y-2 p-5 sm:p-6">
              <h2 className="text-base font-semibold text-ink">Details</h2>
              <p className="text-sm whitespace-pre-line text-muted">
                {issue.description}
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
