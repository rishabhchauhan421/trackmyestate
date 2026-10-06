"use server";

/**
 * Admin › Notifications actions: retry a failed reminder or cancel a
 * queued one. The admin layout hides the page from non-admins, but a
 * Server Action can be called directly, so each one checks the role too.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSession, isAdmin } from "~/server/better-auth/server";
import { db } from "~/server/db";

async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session.user)) {
    throw new Error("Only admins can manage notifications");
  }
}

/**
 * Puts a failed reminder back in the queue to send at the next run, with a
 * fresh set of attempts. Only FAILED jobs: a cancelled one was cancelled
 * for a reason (bill paid, guest stopped) that a retry would ignore.
 */
export async function retryNotification(jobId: string) {
  await requireAdmin();
  const { count } = await db.notificationJob.updateMany({
    where: { id: jobId, status: "FAILED" },
    data: {
      status: "SCHEDULED",
      scheduledFor: new Date(),
      retryCount: 0,
      failedReason: null,
    },
  });
  if (count === 0) throw new Error("Only a failed notification can be retried");

  revalidatePath("/admin/notifications");
  redirect(`/admin/notifications/${jobId}?done=retried`);
}

/** Cancels a reminder that hasn't been sent yet. */
export async function cancelNotification(jobId: string) {
  await requireAdmin();
  const { count } = await db.notificationJob.updateMany({
    where: { id: jobId, status: "SCHEDULED" },
    data: { status: "CANCELLED", failedReason: "Cancelled by an admin" },
  });
  if (count === 0) {
    throw new Error("Only a notification that's still queued can be cancelled");
  }

  revalidatePath("/admin/notifications");
  redirect(`/admin/notifications/${jobId}?done=cancelled`);
}
