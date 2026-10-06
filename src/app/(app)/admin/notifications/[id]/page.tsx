import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import type { ReactNode } from "react";

import { SubmitButton } from "~/app/_components/submit-button";
import { Card, CardHeader } from "~/app/_components/card";
import { Notice } from "~/app/_components/form";
import { PageHeader } from "~/app/_components/page-header";
import { StatusBadge } from "~/app/_components/status-badge";
import { formatDate, formatINR } from "~/lib/format";
import {
  cancelNotification,
  retryNotification,
} from "~/server/actions/admin-notifications";
import { MAX_SEND_ATTEMPTS } from "~/server/notifications/engine";
import { getNotificationDetail } from "~/server/queries/admin-notifications";
import { CHANNEL_LABELS, formatDateTime, ROLE_LABELS } from "../format";

type Step = {
  label: string;
  at?: Date | null;
  note?: ReactNode;
  tone: "done" | "pending" | "danger" | "muted";
};

/** What happened to a job, oldest first, from the fields it keeps. */
function timeline(job: {
  status: string;
  createdAt: Date;
  scheduledFor: Date;
  updatedAt: Date;
  sentAt: Date | null;
  retryCount: number;
  failedReason: string | null;
}): Step[] {
  const steps: Step[] = [{ label: "Queued", at: job.createdAt, tone: "done" }];

  if (job.retryCount > 0) {
    steps.push({
      label: `${job.retryCount} failed attempt${job.retryCount === 1 ? "" : "s"}`,
      note: "Temporary failures are retried after 5 minutes, then 10.",
      tone: "danger",
    });
  }

  switch (job.status) {
    case "SENT":
      steps.push({ label: "Sent", at: job.sentAt, tone: "done" });
      break;
    case "FAILED":
      steps.push({
        label: "Gave up",
        at: job.updatedAt,
        note: job.failedReason,
        tone: "danger",
      });
      break;
    case "CANCELLED":
      steps.push({
        label: "Cancelled",
        at: job.updatedAt,
        note:
          job.failedReason ??
          "The bill was paid or the guest stopped reminders.",
        tone: "muted",
      });
      break;
    case "SKIPPED":
      steps.push({
        label: "Skipped",
        at: job.updatedAt,
        note: job.failedReason,
        tone: "muted",
      });
      break;
    case "PROCESSING":
      steps.push({
        label: "Sending",
        at: job.updatedAt,
        note: "Picked up by the send job. Retried automatically if stuck for 10 minutes.",
        tone: "pending",
      });
      break;
    default:
      steps.push({
        label: job.retryCount > 0 ? "Next attempt" : "Sends",
        at: job.scheduledFor,
        tone: "pending",
      });
  }
  return steps;
}

const DOT = {
  done: "bg-ok",
  pending: "bg-accent",
  danger: "bg-danger",
  muted: "bg-line-strong",
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 px-5 py-3 sm:flex-row sm:gap-4 sm:px-6">
      <dt className="w-32 shrink-0 text-[0.8125rem] text-muted">{label}</dt>
      <dd className="min-w-0 text-sm break-words text-ink">{children}</dd>
    </div>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return (
    <code className="font-mono text-[0.8125rem] break-all">{children}</code>
  );
}

/** Admin › Notifications › one notification: message, history, details. */
export default async function AdminNotificationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const [{ id }, { done }] = await Promise.all([params, searchParams]);
  const detail = /^[0-9a-f]{24}$/i.test(id)
    ? await getNotificationDetail(id)
    : null;
  if (!detail) notFound();
  const { job, owner, bill, guest, recipientRole } = detail;
  const channel = CHANNEL_LABELS[job.channel] ?? job.channel;
  const metadata = (job.metadata ?? {}) as Record<string, unknown>;
  const actionUrl =
    typeof metadata.actionUrl === "string" ? metadata.actionUrl : null;

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Notifications", href: "/admin/notifications" },
          { label: job.title },
        ]}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {job.title}
            <StatusBadge status={job.status} />
          </span>
        }
        description={`${channel} to ${job.recipient} · ${ROLE_LABELS[recipientRole]}`}
        action={
          <>
            {job.status === "FAILED" && (
              <form action={retryNotification.bind(null, job.id)}>
                <SubmitButton>Retry now</SubmitButton>
              </form>
            )}
            {job.status === "SCHEDULED" && (
              <form action={cancelNotification.bind(null, job.id)}>
                <SubmitButton variant="outline" color="red">
                  Cancel
                </SubmitButton>
              </form>
            )}
          </>
        }
      />

      {done === "retried" && (
        <Notice tone="success">
          Queued again — it goes out with the next send run (every 15 minutes).
        </Notice>
      )}
      {done === "cancelled" && (
        <Notice tone="success">Cancelled. It won&apos;t be sent.</Notice>
      )}
      {job.status === "FAILED" && job.failedReason && (
        <Notice tone="error">
          <span className="font-semibold">Last error:</span> {job.failedReason}
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Message" />
            <div className="space-y-3 px-5 py-5 sm:px-6">
              <dl className="space-y-1 text-[0.8125rem]">
                <div className="flex gap-2">
                  <dt className="w-16 shrink-0 text-muted">To</dt>
                  <dd className="min-w-0 break-all text-ink">
                    {job.recipient}
                  </dd>
                </div>
                {job.channel === "EMAIL" && (
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-muted">Subject</dt>
                    <dd className="min-w-0 text-ink">{job.title}</dd>
                  </div>
                )}
              </dl>
              <div className="rounded-xl bg-sunken px-4 py-4 text-sm leading-relaxed whitespace-pre-wrap text-ink">
                {job.body}
              </div>
              {actionUrl && (
                <p className="text-[0.8125rem] text-muted">
                  Button:{" "}
                  <span className="font-medium text-ink">
                    {typeof metadata.actionLabel === "string"
                      ? metadata.actionLabel
                      : "View bill"}
                  </span>{" "}
                  → <Mono>{actionUrl}</Mono>
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Delivery" />
            <ol className="space-y-4 px-5 py-5 sm:px-6">
              {timeline(job).map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className={clsx(
                      "mt-1.5 size-2.5 shrink-0 rounded-full",
                      DOT[step.tone],
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {step.label}
                      {step.at && (
                        <span className="ml-2 font-normal text-muted">
                          {formatDateTime(step.at, true)}
                        </span>
                      )}
                    </p>
                    {step.note && (
                      <p
                        className={clsx(
                          "mt-0.5 text-[0.8125rem] break-words",
                          step.tone === "danger" ? "text-danger" : "text-muted",
                        )}
                      >
                        {step.note}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <p className="border-t border-line-soft px-5 py-3 text-xs text-muted sm:px-6">
              Attempts used: {job.retryCount} of {MAX_SEND_ATTEMPTS}. Times are
              IST.
            </p>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Details" />
            <dl className="divide-y divide-line-soft">
              <Row label="Account">
                {owner ? (
                  <>
                    {owner.name}
                    <span className="block text-xs text-muted">
                      {owner.email}
                    </span>
                  </>
                ) : (
                  <span className="text-muted">Deleted user</span>
                )}
              </Row>
              <Row label="Recipient">
                {ROLE_LABELS[recipientRole]}
                {guest && (
                  <span className="block text-xs text-muted">
                    {guest.name}
                    {guest.optedOutAt
                      ? " · stopped reminders"
                      : guest.pausedAt
                        ? " · paused"
                        : ""}
                  </span>
                )}
              </Row>
              <Row label="Category">
                {job.category.charAt(0) + job.category.slice(1).toLowerCase()}
              </Row>
              {bill ? (
                <Row label="Bill">
                  {bill.description ?? "Bill"}
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                    {formatINR(bill.amount)} · due {formatDate(bill.dueDate)}
                    <StatusBadge status={bill.status} />
                  </span>
                </Row>
              ) : job.billId ? (
                <Row label="Bill">
                  <span className="text-muted">Deleted</span>
                </Row>
              ) : null}
              <Row label="Scheduled for">
                {formatDateTime(job.scheduledFor, true)}
              </Row>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Identifiers" />
            <dl className="divide-y divide-line-soft">
              <Row label="Job ID">
                <Mono>{job.id}</Mono>
              </Row>
              <Row label="Provider ID">
                {job.providerMessageId ? (
                  <Mono>{job.providerMessageId}</Mono>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </Row>
              <Row label="Idempotency">
                {job.idempotencyKey ? (
                  <Mono>{job.idempotencyKey}</Mono>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </Row>
            </dl>
          </Card>

          <Link
            href="/admin/notifications"
            className="inline-block text-sm font-medium text-accent hover:text-accent-strong"
          >
            ← Back to the log
          </Link>
        </div>
      </div>
    </>
  );
}
