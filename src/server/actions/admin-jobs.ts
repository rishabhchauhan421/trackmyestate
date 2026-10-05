"use server";

/**
 * Admin › Jobs: run the background jobs on demand — the same code the
 * crons run. The admin layout hides the page from non-admins, but a
 * Server Action can be called directly, so each one checks the role too.
 */

import { redirect } from "next/navigation";

import { getSession, isAdmin } from "~/server/better-auth/server";
import { generateBills } from "~/server/bills/generate";
import { processDueNotificationJobs } from "~/server/notifications/process";
import { generateReminders } from "~/server/reminders/generate";

async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session.user)) throw new Error("Only admins can run jobs");
}

function done(job: string, result: Record<string, string | number | boolean>) {
  const params = new URLSearchParams({ ran: job });
  for (const [key, value] of Object.entries(result)) {
    params.set(key, String(value));
  }
  redirect(`/admin/jobs?${params.toString()}`);
}

export async function runBillGeneration() {
  await requireAdmin();
  const summary = await generateBills();
  done("bills", {
    created: summary.billsCreated,
    scanned: summary.schedulesScanned,
    skipped: summary.skippedNoAmount,
    more: summary.hasMore,
  });
}

export async function runReminderGeneration() {
  await requireAdmin();
  const summary = await generateReminders();
  done("reminders", {
    queued: summary.queued,
    scanned: summary.scanned,
    more: summary.hasMore,
  });
}

export async function runNotificationDrain() {
  await requireAdmin();
  const summary = await processDueNotificationJobs();
  done("notifications", {
    total: summary.total,
    sent: summary.outcomes.SENT,
    cancelled: summary.outcomes.CANCELLED,
    failed: summary.outcomes.FAILED + summary.outcomes.ERRORED,
    retrying: summary.outcomes.RETRY_SCHEDULED,
    more: summary.hasMore,
  });
}
