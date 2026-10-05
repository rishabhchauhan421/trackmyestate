import "server-only";

import type {
  EventCategory,
  Prisma,
  ReminderChannel,
} from "../../../generated/prisma";
import {
  LIVE_REMINDER_CHANNELS,
  REMINDER_CATEGORIES,
  normalizeOffsets,
  reminderCategoryConfig,
  sameOffsets,
} from "~/lib/reminders";
import { db } from "~/server/db";
import { NOT_SOFT_DELETED } from "~/server/queries/shared";

/** The item links on `NotificationRule`; none set = a category default. */
const ITEM_LINKS = [
  "billScheduleId",
  "billId",
  "propertyId",
  "leaseId",
  "loanId",
  "policyId",
  "investmentId",
] as const;

/**
 * Matches an owner's category-level (Settings) rules. Item links are
 * matched as null *or absent*: rules are created without them, and MongoDB
 * stores an omitted optional field as a missing key, which a plain `null`
 * filter doesn't match (same reason as `NOT_SOFT_DELETED`).
 */
export const CATEGORY_LEVEL: Prisma.NotificationRuleWhereInput = {
  AND: [
    NOT_SOFT_DELETED,
    ...ITEM_LINKS.map((field) => ({
      OR: [{ [field]: null }, { [field]: { isSet: false } }],
    })),
  ],
};

export type EffectiveReminder = {
  offsetDays: number;
  channels: ReminderChannel[];
};

export type CategoryReminderSettings = {
  category: EventCategory;
  offsets: number[];
  channels: ReminderChannel[];
  /** True when the user has changed this category from the defaults. */
  customised: boolean;
};

type StoredRule = {
  category: EventCategory;
  offsetDays: number;
  channels: ReminderChannel[];
  active: boolean;
};

const RULE_FIELDS = {
  category: true,
  offsetDays: true,
  channels: true,
  active: true,
} as const;

/**
 * Any stored row for a category means the user customised it. Active rows
 * are its reminders; a category turned off entirely is stored as a single
 * inactive row, so "no reminders" doesn't fall back to the defaults.
 */
function settingsFromRules(
  category: EventCategory,
  rules: StoredRule[],
): CategoryReminderSettings {
  const own = rules.filter((rule) => rule.category === category);
  if (own.length === 0) {
    return {
      category,
      offsets: reminderCategoryConfig(category).defaultOffsets,
      channels: LIVE_REMINDER_CHANNELS,
      customised: false,
    };
  }
  const active = own.filter((rule) => rule.active);
  return {
    category,
    offsets: normalizeOffsets(active.map((rule) => rule.offsetDays)),
    channels: active[0]?.channels ?? LIVE_REMINDER_CHANNELS,
    customised: true,
  };
}

function sameChannels(a: ReminderChannel[], b: ReminderChannel[]) {
  return [...new Set(a)].sort().join() === [...new Set(b)].sort().join();
}

/** Each category's effective schedule for one owner, for Settings. */
export async function getReminderSettings(
  ownerId: string,
): Promise<CategoryReminderSettings[]> {
  const rules = await db.notificationRule.findMany({
    where: { ownerId, ...CATEGORY_LEVEL },
    select: RULE_FIELDS,
  });
  return REMINDER_CATEGORIES.map(({ category }) =>
    settingsFromRules(category, rules),
  );
}

/**
 * Effective reminders per (owner, category) for many owners at once — the
 * generator's lookup. Owners with no stored rules for a category get the
 * built-in defaults.
 */
export async function getEffectiveRemindersForOwners(ownerIds: string[]) {
  const rules = ownerIds.length
    ? await db.notificationRule.findMany({
        where: { ownerId: { in: ownerIds }, ...CATEGORY_LEVEL },
        select: { ownerId: true, ...RULE_FIELDS },
      })
    : [];

  return (ownerId: string, category: EventCategory): EffectiveReminder[] => {
    const { offsets, channels } = settingsFromRules(
      category,
      rules.filter((rule) => rule.ownerId === ownerId),
    );
    return offsets.map((offsetDays) => ({ offsetDays, channels }));
  };
}

/**
 * Replaces an owner's schedule for one category. Choosing exactly the
 * defaults removes the stored rules instead, so the category goes back to
 * following the built-in defaults (and any future improvement to them).
 * An empty `offsets` turns the category's reminders off.
 */
export async function saveCategoryReminders(
  ownerId: string,
  category: EventCategory,
  offsets: number[],
  channels: ReminderChannel[],
) {
  const isDefault =
    sameOffsets(offsets, reminderCategoryConfig(category).defaultOffsets) &&
    sameChannels(channels, LIVE_REMINDER_CHANNELS);

  await db.notificationRule.deleteMany({
    where: { ownerId, category, ...CATEGORY_LEVEL },
  });
  if (isDefault) return;

  if (offsets.length === 0) {
    await db.notificationRule.create({
      data: {
        ownerId,
        category,
        anchor: "DUE_DATE",
        offsetDays: 0,
        channels,
        active: false,
      },
    });
    return;
  }

  await db.notificationRule.createMany({
    data: normalizeOffsets(offsets).map((offsetDays) => ({
      ownerId,
      category,
      anchor: "DUE_DATE" as const,
      offsetDays,
      channels,
    })),
  });
}
