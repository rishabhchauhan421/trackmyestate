import "server-only";

import { resolveTimeZone } from "~/lib/time-zone";
import { db } from "~/server/db";

/** The user's time zone, or the default when they haven't picked one. */
export async function getUserTimeZone(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  return resolveTimeZone(user?.timezone);
}

/** What Settings shows about the user: profile, region and channels. */
export async function getUserSettings(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      currency: true,
      timezone: true,
      phone: true,
      reminderHour: true,
    },
  });
  if (!user) return null;
  return { ...user, timezone: resolveTimeZone(user.timezone) };
}
