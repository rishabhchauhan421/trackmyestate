import "server-only";

import { cache } from "react";

import { resolveTimeZone } from "~/lib/time-zone";
import { db } from "~/server/db";

/**
 * The two settings nearly every page formats with, read in one query and
 * shared by every caller within a request (React's `cache()`), so asking
 * for both — or asking twice — costs a single database round trip.
 */
const getUserRegion = cache(async (userId: string) => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true, currency: true },
  });
  return {
    timeZone: resolveTimeZone(user?.timezone),
    currency: user?.currency ?? ("INR" as const),
  };
});

/** The user's time zone, or the default when they haven't picked one. */
export async function getUserTimeZone(userId: string) {
  return (await getUserRegion(userId)).timeZone;
}

/** The user's currency (Settings › General): amounts without one use it. */
export async function getUserCurrency(userId: string) {
  return (await getUserRegion(userId)).currency;
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
