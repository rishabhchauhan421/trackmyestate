import { Button } from "~/app/_components/button";
import { Card } from "~/app/_components/card";
import { Notice } from "~/app/_components/form";
import { PageHeader } from "~/app/_components/page-header";
import {
  runBillGeneration,
  runNotificationDrain,
  runReminderGeneration,
} from "~/server/actions/admin-jobs";
import { HORIZON_DAYS, LOOKBACK_DAYS } from "~/server/bills/generate";
import { getJobsOverview } from "~/server/queries/admin";

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
  action,
}: {
  title: string;
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
      <form action={action} className="mt-auto">
        <Button type="submit" variant="outline" className="w-full">
          Run now
        </Button>
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
  const [overview, params] = await Promise.all([
    getJobsOverview(),
    searchParams,
  ]);
  const message = resultMessage(params);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Jobs" }]}
        title="Background jobs"
        description="Vercel runs all three once a day (09:00 IST); GitHub Actions runs reminders hourly and sending every 15 minutes. Run one now to catch up or check a change — every job is safe to run any number of times."
      />

      {message && <Notice tone="success">{message}</Notice>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <JobCard
          title="1 · Generate bills"
          schedule="Daily, 9:00 am IST"
          description={`Turns every active schedule (utilities, EMIs…) into bills due from ${LOOKBACK_DAYS} days ago to ${HORIZON_DAYS} days ahead. Never creates the same bill twice.`}
          stats={[
            { label: "Active schedules", value: overview.activeSchedules },
            { label: "Unpaid, next 35 days", value: overview.upcomingBills },
          ]}
          action={runBillGeneration}
        />
        <JobCard
          title="2 · Queue reminders"
          schedule="Hourly + daily"
          description="Works out which reminders fall today for each unpaid bill, in each owner's time zone, and queues them for their send time."
          stats={[
            { label: "Queued, not yet due", value: overview.scheduledJobs },
            { label: "Due to send now", value: overview.dueJobs },
          ]}
          action={runReminderGeneration}
        />
        <JobCard
          title="3 · Send reminders"
          schedule="Every 15 min + daily"
          description="Sends queued reminders that are due, retries temporary failures, and cancels ones for bills that have been paid."
          stats={[
            { label: "Sent, last 24 h", value: overview.sentLast24h },
            {
              label: "Failed, last 7 days",
              value: overview.failedLast7d,
              tone: "danger",
            },
          ]}
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
