import { SubmitButton } from "~/app/_components/submit-button";
import { Card } from "~/app/_components/card";
import { Notice } from "~/app/_components/form";
import { PageHeader } from "~/app/_components/page-header";
import {
  runBillGeneration,
  runNotificationDrain,
  runReminderGeneration,
} from "~/server/actions/admin-jobs";
import { HORIZON_DAYS, LOOKBACK_DAYS } from "~/server/bills/generate";
import { cronHealth, sendHealth, type CronJobHealth } from "~/server/cron-runs";
import { getJobsOverview } from "~/server/queries/admin";
import { formatDateTime } from "../notifications/format";

type SearchParams = Record<string, string | undefined>;

/** "Created 12 bills from 40 schedules." — the last manual run's result. */
function resultMessage(params: SearchParams) {
  const n = (key: string) => Number(params[key] ?? 0);
  const more =
    params.more === "true"
      ? " It stopped at its time limit — run it again to finish."
      : "";
  switch (params.ran) {
    case "bills":
      return `Bill generation: created ${n("created")} bill${n("created") === 1 ? "" : "s"} from ${n("scanned")} active schedule${n("scanned") === 1 ? "" : "s"}${n("skipped") ? ` (${n("skipped")} skipped — no amount set)` : ""}.${more}`;
    case "reminders":
      return `Reminders: queued ${n("queued")} new reminder${n("queued") === 1 ? "" : "s"} from ${n("scanned")} upcoming bill${n("scanned") === 1 ? "" : "s"}.${more}`;
    case "notifications":
      return `Sending: ${n("sent")} sent, ${n("cancelled")} cancelled (paid or guest stopped), ${n("retrying")} retrying, ${n("failed")} failed — of ${n("total")} due.${more}`;
    default:
      return null;
  }
}

function JobCard({
  title,
  schedule,
  description,
  stats,
  health,
  action,
}: {
  title: string;
  /** The last scheduled or manual run, from `CronRun`. */
  health: CronJobHealth | undefined;
  schedule: string;
  description: string;
  stats: { label: string; value: number; tone?: "danger" }[];
  action: () => Promise<void>;
}) {
  return (
    <Card className="flex flex-col gap-4 p-5 sm:p-6">
      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <span className="text-xs font-medium text-muted">{schedule}</span>
        </div>
        <p className="text-[0.8125rem] leading-relaxed text-muted">
          {description}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl bg-sunken px-3.5 py-3">
            <dt className="text-xs text-muted">{stat.label}</dt>
            <dd
              className={`mt-1 font-display text-xl font-semibold ${
                stat.tone === "danger" && stat.value > 0
                  ? "text-danger"
                  : "text-ink"
              }`}
            >
              {stat.value.toLocaleString("en-IN")}
            </dd>
          </div>
        ))}
      </dl>
      <p
        className={`text-xs ${health?.late || health?.lastWarning ? "font-semibold text-danger" : "text-muted"}`}
      >
        {health?.lastSucceededAt
          ? `Last succeeded ${formatDateTime(health.lastSucceededAt)}`
          : "Hasn't run yet"}
        {health?.late && " · late: check Vercel Cron"}
        {health?.lastError && ` · last error: ${health.lastError}`}
        {health?.lastWarning && ` · ${health.lastWarning}`}
      </p>
      <form action={action} className="mt-auto">
        <SubmitButton variant="outline" className="w-full">
          Run now
        </SubmitButton>
      </form>
    </Card>
  );
}

/** Admin › Jobs: the background jobs, their queues, and a "Run now". */
export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [overview, health, sending, params] = await Promise.all([
    getJobsOverview(),
    cronHealth(),
    sendHealth(),
    searchParams,
  ]);
  const healthOf = (job: CronJobHealth["job"]) =>
    health.find((entry) => entry.job === job);
  const message = resultMessage(params);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Jobs" }]}
        title="Background jobs"
        description="Vercel Cron runs these on schedule; /api/health/cron reports any job that misses two runs, for an uptime monitor. Run one now to catch up or check a change — every job is safe to run any number of times."
      />

      {message && <Notice tone="success">{message}</Notice>}
      {sending.failing && (
        <Notice tone="error">
          Most reminders are failing: {sending.failed} failed and {sending.sent}{" "}
          sent in the last 24 hours. Check the email provider&apos;s API key and
          sending domain.
        </Notice>
      )}
      {sending.stuck && (
        <Notice tone="error">
          Reminders are stuck: the oldest has been due for{" "}
          {sending.oldestDueMinutes} minutes. Check that the send job is
          running.
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <JobCard
          title="1 · Generate bills"
          schedule="Daily, 8:30 am IST"
          description={`Turns every active schedule (utilities, EMIs…) into bills due from ${LOOKBACK_DAYS} days ago to ${HORIZON_DAYS} days ahead. Bills each period once, and never days before a schedule's terms were last set.`}
          stats={[
            { label: "Active schedules", value: overview.activeSchedules },
            { label: "Unpaid, next 35 days", value: overview.upcomingBills },
          ]}
          health={healthOf("bills")}
          action={runBillGeneration}
        />
        <JobCard
          title="2 · Queue reminders"
          schedule="Hourly"
          description="Works out which reminders fall today for each unpaid bill, in each owner's time zone, and queues them for their send time. Also queues any that were missed yesterday."
          stats={[
            { label: "Queued, not yet due", value: overview.scheduledJobs },
            { label: "Due to send now", value: overview.dueJobs },
          ]}
          health={healthOf("reminders")}
          action={runReminderGeneration}
        />
        <JobCard
          title="3 · Send reminders"
          schedule="Every 15 min"
          description="Sends queued reminders that are due (one email per person), retries temporary failures, and cancels ones for bills that have been paid."
          stats={[
            { label: "Sent, last 24 h", value: overview.sentLast24h },
            {
              label: "Failed, last 7 days",
              value: overview.failedLast7d,
              tone: "danger",
            },
          ]}
          health={healthOf("notifications")}
          action={runNotificationDrain}
        />
      </div>

      {overview.processingJobs > 0 && (
        <p className="text-[0.8125rem] text-muted">
          {overview.processingJobs} reminder
          {overview.processingJobs === 1 ? " is" : "s are"} mid-send. If one
          stays that way for 10 minutes it&apos;s retried automatically.
        </p>
      )}
    </>
  );
}
