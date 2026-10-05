"use server";

/**
 * Server Actions for the Settings page. Each saves one of the signed-in
 * user's own preferences, so ownership is simply the session's user id.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { EventCategory } from "../../../generated/prisma";
import { parseFormData, text } from "~/lib/form";
import {
  LIVE_REMINDER_CHANNELS,
  MAX_REMINDERS_PER_CATEGORY,
  REMINDER_CATEGORIES,
  REMINDER_OFFSET_PRESETS,
} from "~/lib/reminders";
import { isValidTimeZone, normalizeTimeZone } from "~/lib/time-zone";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { saveCategoryReminders } from "~/server/reminders/rules";

const timeZoneSchema = z.object({
  timezone: text("Choose a time zone")
    .refine(isValidTimeZone, "Choose a valid time zone")
    .transform(normalizeTimeZone),
});

/** Saves the user's time zone (used for reminder times and "today"). */
export async function updateTimeZone(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { timezone } = parseFormData(timeZoneSchema, formData);

  await db.user.update({
    where: { id: session.user.id },
    data: { timezone },
  });

  revalidatePath("/settings");
  redirect("/settings?saved=timezone");
}

/** Form field holding one category's chosen offsets (one value per chip). */
function offsetsField(category: EventCategory) {
  return `offsets.${category}`;
}

const offsetsSchema = z
  .array(
    z.coerce
      .number()
      .int()
      .refine((offset) => REMINDER_OFFSET_PRESETS.includes(offset), {
        message: "Choose reminders from the options shown",
      }),
  )
  .max(MAX_REMINDERS_PER_CATEGORY, {
    message: `Choose at most ${MAX_REMINDERS_PER_CATEGORY} reminders per kind`,
  });

/**
 * Saves the reminder schedule for every category on the Settings form.
 * Each category's checked chips arrive as repeated `offsets.<CATEGORY>`
 * values; none checked turns that category's reminders off.
 */
export async function updateReminderSettings(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const chosen = REMINDER_CATEGORIES.map(({ category }) => {
    const result = offsetsSchema.safeParse(
      formData.getAll(offsetsField(category)),
    );
    if (!result.success) {
      throw new Error(result.error.issues[0]?.message ?? "Invalid reminders");
    }
    return { category, offsets: result.data };
  });

  for (const { category, offsets } of chosen) {
    await saveCategoryReminders(
      session.user.id,
      category,
      offsets,
      LIVE_REMINDER_CHANNELS,
    );
  }

  revalidatePath("/settings");
  redirect("/settings?saved=reminders");
}

/** Puts one category back on the built-in default schedule. */
export async function resetCategoryReminders(category: EventCategory) {
  const session = await getSession();
  if (!session) redirect("/login");

  const config = REMINDER_CATEGORIES.find((c) => c.category === category);
  if (!config) throw new Error("Unknown reminder category");

  await saveCategoryReminders(
    session.user.id,
    category,
    config.defaultOffsets,
    LIVE_REMINDER_CHANNELS,
  );

  revalidatePath("/settings");
  redirect("/settings?saved=reminders");
}
