"use server";

/**
 * Server Actions for the Settings page. Each saves one of the signed-in
 * user's own preferences, so ownership is simply the session's user id.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  Currency,
  type EventCategory,
  type ReminderChannel,
} from "../../../generated/prisma";
import {
  enumValue,
  number,
  optionalText,
  parseFormData,
  text,
} from "~/lib/form";
import { normalizeIndianMobile } from "~/lib/phone";
import {
  LIVE_REMINDER_CHANNELS,
  MAX_REMINDERS_PER_CATEGORY,
  REMINDER_CATEGORIES,
  REMINDER_HOURS,
  REMINDER_OFFSET_PRESETS,
} from "~/lib/reminders";
import { isValidTimeZone, normalizeTimeZone } from "~/lib/time-zone";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import {
  renderTransactionalEmail,
  sendTransactionalEmail,
} from "~/server/email/send";
import { saveCategoryReminders } from "~/server/reminders/rules";

const generalSchema = z.object({
  name: text("Enter your name"),
  timezone: text("Choose a time zone")
    .refine(isValidTimeZone, "Choose a valid time zone")
    .transform(normalizeTimeZone),
  currency: enumValue(Currency, "Choose a currency"),
});

/** Settings › General: profile name, time zone and currency. */
export async function updateGeneralSettings(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { name, timezone, currency } = parseFormData(generalSchema, formData);

  await db.user.update({
    where: { id: session.user.id },
    data: { name, timezone, currency },
  });

  revalidatePath("/settings");
  redirect("/settings?saved=general");
}

const channelsSchema = z.object({
  mobile: optionalText().transform((value, ctx) => {
    if (!value) return null;
    const phone = normalizeIndianMobile(value);
    if (!phone) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid 10-digit mobile number",
      });
      return z.NEVER;
    }
    return phone;
  }),
  reminderHour: number("Choose a time for reminders", { int: true }).refine(
    (hour) => REMINDER_HOURS.includes(hour),
    "Choose a time for reminders",
  ),
});

/** Settings › Channels: mobile number and the reminder send time. */
export async function updateChannelSettings(formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { mobile, reminderHour } = parseFormData(channelsSchema, formData);

  await db.user.update({
    where: { id: session.user.id },
    data: { phone: mobile, reminderHour },
  });

  revalidatePath("/settings", "layout");
  redirect("/settings/channels?saved=channels");
}

/** Sends a sample reminder to the user's own email. */
export async function sendTestEmail() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { html, text } = renderTransactionalEmail({
    heading: "This is a test reminder",
    paragraphs: [
      "Your TrackMyEstate reminders will arrive here, at the time you've chosen in Settings.",
    ],
  });
  const ok = await sendTransactionalEmail({
    to: session.user.email,
    subject: "TrackMyEstate test reminder",
    html,
    text,
  });

  redirect(`/settings/channels?saved=${ok ? "test" : "test-failed"}`);
}

/** Form fields holding one category's chosen offsets / channels. */
function offsetsField(category: EventCategory) {
  return `offsets.${category}`;
}
function channelsField(category: EventCategory) {
  return `channels.${category}`;
}

// Only channels that can deliver can be chosen (SMS and WhatsApp aren't
// built yet), so a stored rule never promises a message that won't come.
const channelsListSchema = z.array(
  z.enum(LIVE_REMINDER_CHANNELS as [ReminderChannel, ...ReminderChannel[]], {
    message: "That channel isn't available yet",
  }),
);

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
    const channels = channelsListSchema.safeParse(
      formData.getAll(channelsField(category)),
    );
    if (!channels.success) {
      throw new Error(channels.error.issues[0]?.message ?? "Invalid channels");
    }
    if (result.data.length > 0 && channels.data.length === 0) {
      throw new Error(
        "Choose at least one channel for each kind you're reminded about",
      );
    }
    return { category, offsets: result.data, channels: channels.data };
  });

  for (const { category, offsets, channels } of chosen) {
    await saveCategoryReminders(
      session.user.id,
      category,
      offsets,
      channels.length > 0 ? channels : LIVE_REMINDER_CHANNELS,
    );
  }

  revalidatePath("/settings/reminders");
  redirect("/settings/reminders?saved=reminders");
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

  revalidatePath("/settings/reminders");
  redirect("/settings/reminders?saved=reminders");
}
