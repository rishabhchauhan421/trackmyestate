import Link from "next/link";
import clsx from "clsx";

import { Card, StatCard } from "~/app/_components/card";
import { BellIcon, SearchIcon } from "~/app/_components/icons";
import { PageHeader } from "~/app/_components/page-header";
import { StatusBadge } from "~/app/_components/status-badge";
import {
  getNotificationLog,
  getNotificationLogStats,
  LOG_CHANNELS,
  LOG_PAGE_SIZE,
  LOG_STATUSES,
  type LogChannel,
  type LogFilters,
  type LogStatus,
} from "~/server/queries/admin-notifications";
import { CHANNEL_LABELS, formatDateTime, ROLE_LABELS } from "./format";

type SearchParams = Record<string, string | undefined>;

function parseFilters(params: SearchParams): LogFilters {
  const channel = params.channel?.toUpperCase();
  const status = params.status?.toUpperCase();
  return {
    channel: LOG_CHANNELS.includes(channel as LogChannel)
      ? (channel as LogChannel)
      : undefined,
    status: LOG_STATUSES.includes(status as LogStatus)
      ? (status as LogStatus)
      : undefined,
    q: params.q?.trim() ? params.q.trim() : undefined,
    page: Number(params.page) > 0 ? Number(params.page) : 1,
  };
}

/** This page's URL with some filters changed; changing a filter resets the page. */
function hrefWith(filters: LogFilters, change: Partial<LogFilters>) {
  const next = { ...filters, page: undefined, ...change };
  const query = new URLSearchParams();
  if (next.channel) query.set("channel", next.channel.toLowerCase());
  if (next.status) query.set("status", next.status.toLowerCase());
  if (next.q) query.set("q", next.q);
  if (next.page && next.page > 1) query.set("page", String(next.page));
  const qs = query.toString();
  return `/admin/notifications${qs ? `?${qs}` : ""}`;
}

const STATUS_LABELS: Record<LogStatus, string> = {
  SENT: "Sent",
  SCHEDULED: "Queued",
  PROCESSING: "Sending",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  SKIPPED: "Skipped",
};

/** Admin › Notifications: every reminder, filterable by channel and status. */
export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = parseFilters(await searchParams);
  const [log, stats] = await Promise.all([
    getNotificationLog(filters),
    getNotificationLogStats(),
  ]);
  const first = (log.page - 1) * LOG_PAGE_SIZE + 1;
  const last = first + log.rows.length - 1;
  const filtered = Boolean(filters.channel ?? filters.status ?? filters.q);

  const tabs: { label: string; channel?: LogChannel; count: number }[] = [
    { label: "All", count: log.counts.ALL },
    ...LOG_CHANNELS.map((channel) => ({
      label: CHANNEL_LABELS[channel]!,
      channel,
      count: log.counts[channel],
    })),
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Notifications" },
        ]}
        title="Notification log"
        description="Every reminder the app has queued or sent, across all users. Open one to see the message, its delivery history and why it failed."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sent, last 24 h" value={stats.sent24h} />
        <StatCard label="Queued" value={stats.queued} hint="Not yet due" />
        <StatCard
          label="Cancelled, 7 days"
          value={stats.cancelled7d}
          hint="Bill paid or guest stopped"
        />
        <StatCard
          label="Failed, 7 days"
          value={stats.failed7d}
          valueClassName={stats.failed7d > 0 ? "text-danger" : undefined}
        />
      </div>

      <Card>
        <div className="space-y-4 border-b border-line-soft px-5 pt-4 pb-4 sm:px-6">
          <nav
            aria-label="Channel"
            className="-mx-1 flex gap-1 overflow-x-auto border-b border-line-soft"
          >
            {tabs.map((tab) => {
              const active = tab.channel === filters.channel;
              return (
                <Link
                  key={tab.label}
                  href={hrefWith(filters, { channel: tab.channel })}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 pb-3 text-sm font-medium transition-colors",
                    active
                      ? "border-accent text-ink"
                      : "border-transparent text-muted hover:text-ink",
                  )}
                >
                  {tab.label}
                  <span
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold",
                      active
                        ? "bg-accent-soft text-accent-strong"
                        : "bg-sunken text-muted",
                    )}
                  >
                    {tab.count.toLocaleString("en-IN")}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2" aria-label="Status">
              {[undefined, ...LOG_STATUSES].map((status) => {
                const active = status === filters.status;
                return (
                  <Link
                    key={status ?? "any"}
                    href={hrefWith(filters, { status })}
                    aria-current={active ? "true" : undefined}
                    className={clsx(
                      "inline-flex h-8 items-center rounded-full border px-3 text-[0.8125rem] font-medium transition-colors",
                      active
                        ? "border-night bg-night text-white"
                        : "border-line-strong bg-surface text-ink-2 hover:bg-sunken",
                    )}
                  >
                    {status ? STATUS_LABELS[status] : "Any status"}
                  </Link>
                );
              })}
            </div>

            <form action="/admin/notifications" className="relative lg:w-72">
              {filters.channel && (
                <input
                  type="hidden"
                  name="channel"
                  value={filters.channel.toLowerCase()}
                />
              )}
              {filters.status && (
                <input
                  type="hidden"
                  name="status"
                  value={filters.status.toLowerCase()}
                />
              )}
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                name="q"
                defaultValue={filters.q}
                placeholder="Search recipient or subject"
                aria-label="Search recipient or subject"
                className="h-9 w-full rounded-control border border-line-strong bg-surface pr-3 pl-9 text-sm text-ink placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
              />
            </form>
          </div>
        </div>

        {log.rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
              <BellIcon className="size-6" />
            </div>
            <div className="max-w-sm">
              <h3 className="text-base font-semibold text-ink">
                No notifications match
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {filtered
                  ? "Try another channel or status, or clear the search."
                  : "Reminders appear here once the reminder job queues them."}
              </p>
            </div>
            {filtered && (
              <Link
                href="/admin/notifications"
                className="text-sm font-medium text-accent hover:text-accent-strong"
              >
                Clear filters
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <thead className="bg-sunken text-xs text-muted">
                <tr>
                  <th className="px-5 py-2.5 font-medium sm:px-6">When</th>
                  <th className="px-3 py-2.5 font-medium">Channel</th>
                  <th className="px-3 py-2.5 font-medium">Recipient</th>
                  <th className="px-3 py-2.5 font-medium">Subject</th>
                  <th className="px-5 py-2.5 text-right font-medium sm:px-6">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {log.rows.map((row) => (
                  <tr
                    key={row.id}
                    className="group relative hover:bg-sunken/60"
                  >
                    <td className="px-5 py-3 whitespace-nowrap text-ink-2 sm:px-6">
                      <Link
                        href={`/admin/notifications/${row.id}`}
                        className="after:absolute after:inset-0"
                      >
                        {formatDateTime(row.sentAt ?? row.scheduledFor)}
                      </Link>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-2">
                      {CHANNEL_LABELS[row.channel] ?? row.channel}
                    </td>
                    <td className="max-w-56 px-3 py-3">
                      <p className="truncate font-medium text-ink">
                        {row.recipient}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {ROLE_LABELS[row.recipientRole]}
                        {row.ownerName && row.recipientRole !== "owner"
                          ? ` · for ${row.ownerName}`
                          : ""}
                      </p>
                    </td>
                    <td className="max-w-72 px-3 py-3">
                      <p className="truncate text-ink">{row.title}</p>
                      {row.status === "FAILED" && row.failedReason && (
                        <p className="truncate text-xs text-danger">
                          {row.failedReason}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right sm:px-6">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {log.total > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-line-soft px-5 py-3 text-[0.8125rem] text-muted sm:px-6">
            <span>
              {first.toLocaleString("en-IN")}–{last.toLocaleString("en-IN")} of{" "}
              {log.total.toLocaleString("en-IN")}
            </span>
            <div className="flex gap-2">
              <PageLink
                href={hrefWith(filters, { page: log.page - 1 })}
                disabled={log.page <= 1}
              >
                Previous
              </PageLink>
              <PageLink
                href={hrefWith(filters, { page: log.page + 1 })}
                disabled={log.page >= log.pageCount}
              >
                Next
              </PageLink>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: string;
}) {
  const className =
    "inline-flex h-8 items-center rounded-control border border-line-strong bg-surface px-3 font-medium text-ink";
  return disabled ? (
    <span aria-disabled="true" className={`${className} opacity-40`}>
      {children}
    </span>
  ) : (
    <Link href={href} className={`${className} hover:bg-sunken`}>
      {children}
    </Link>
  );
}
