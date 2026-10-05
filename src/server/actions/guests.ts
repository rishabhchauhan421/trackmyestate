"use server";

/**
 * Server Actions for Settings › Guests — people who get reminders about
 * some of the owner's payments without an account. Every mutation is
 * scoped to the signed-in owner's own guests.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { EventCategory, ReminderChannel } from "../../../generated/prisma";
import { normalizeIndianMobile } from "~/lib/phone";
import { REMINDER_CATEGORIES } from "~/lib/reminders";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";
import { sendGuestWelcomeEmail } from "~/server/guests/emails";
import { getGuestForOwner } from "~/server/queries/guests";
import { NOT_SOFT_DELETED } from "~/server/queries/shared";

const CHANNELS = ["EMAIL", "SMS", "WHATSAPP"] as const;
const CATEGORIES = REMINDER_CATEGORIES.map((c) => c.category) as [
  EventCategory,
  ...EventCategory[],
];

const guestSchema = z
  .object({
    name: z.string().trim().min(1, "Enter the guest's name").max(80),
    relationship: z
      .string()
      .trim()
      .max(40)
      .transform((value) => value || null),
    email: z
      .string()
      .trim()
      .transform((value) => value || null)
      .pipe(z.email("Enter a valid email").nullable()),
    mobile: z
      .string()
      .trim()
      .transform((value, ctx) => {
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
    channels: z
      .array(z.enum(CHANNELS, "Choose how to send reminders"))
      .min(1, "Choose at least one way to send reminders"),
    categories: z
      .array(z.enum(CATEGORIES, "Choose what to remind them about"))
      .min(1, "Choose at least one kind of payment"),
    propertyScope: z.enum(["all", "some"]),
    propertyIds: z.array(z.string()),
    when: z.enum(["schedule", "dueDay"]),
  })
  .superRefine((guest, ctx) => {
    if (!guest.email && !guest.mobile) {
      ctx.addIssue({
        code: "custom",
        message: "Add an email or a mobile number",
      });
    }
    if (guest.channels.includes("EMAIL") && !guest.email) {
      ctx.addIssue({
        code: "custom",
        message: "Add an email to send by email",
      });
    }
    if (
      (guest.channels.includes("SMS") || guest.channels.includes("WHATSAPP")) &&
      !guest.mobile
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Add a mobile number to send by SMS or WhatsApp",
      });
    }
    if (guest.propertyScope === "some" && guest.propertyIds.length === 0) {
      ctx.addIssue({ code: "custom", message: "Choose at least one property" });
    }
  });

/** Reads the guest form (checkbox groups arrive as repeated values). */
function parseGuestForm(formData: FormData) {
  const one = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  const many = (key: string) =>
    formData.getAll(key).filter((v): v is string => typeof v === "string");

  const result = guestSchema.safeParse({
    name: one("name"),
    relationship: one("relationship"),
    email: one("email"),
    mobile: one("mobile"),
    channels: many("channels"),
    categories: many("categories"),
    propertyScope: one("propertyScope") || "all",
    propertyIds: many("propertyIds"),
    when: one("when") || "schedule",
  });
  if (!result.success) {
    throw new Error(
      result.error.issues[0]?.message ?? "Check the guest's details",
    );
  }
  return result.data;
}

async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Keeps only property ids the owner actually has. */
async function ownedPropertyIds(ownerId: string, propertyIds: string[]) {
  if (propertyIds.length === 0) return [];
  const owned = await db.property.findMany({
    where: { id: { in: propertyIds }, ownerId, ...NOT_SOFT_DELETED },
    select: { id: true },
  });
  if (owned.length !== new Set(propertyIds).size) {
    throw new Error("Property not found");
  }
  return owned.map((property) => property.id);
}

function guestData(
  guest: ReturnType<typeof parseGuestForm>,
  propertyIds: string[],
) {
  return {
    name: guest.name,
    relationship: guest.relationship,
    email: guest.email,
    phone: guest.mobile,
    channels: guest.channels as ReminderChannel[],
    categories: guest.categories,
    propertyIds: guest.propertyScope === "some" ? propertyIds : [],
    dueDayOnly: guest.when === "dueDay",
  };
}

export async function createGuest(formData: FormData) {
  const session = await requireSession();
  const guest = parseGuestForm(formData);
  const propertyIds = await ownedPropertyIds(
    session.user.id,
    guest.propertyScope === "some" ? guest.propertyIds : [],
  );

  const created = await db.guest.create({
    data: { ownerId: session.user.id, ...guestData(guest, propertyIds) },
  });

  // Tell them before the first reminder arrives, with a way to stop.
  if (created.email && created.channels.includes("EMAIL")) {
    await sendGuestWelcomeEmail({
      guestId: created.id,
      to: created.email,
      guestName: created.name,
      ownerName: session.user.name,
      categories: created.categories,
    });
  }

  revalidatePath("/settings/guests");
  redirect("/settings/guests?saved=added");
}

export async function updateGuest(guestId: string, formData: FormData) {
  const session = await requireSession();
  const existing = await getGuestForOwner(guestId, session.user.id);
  if (!existing) throw new Error("Guest not found");

  const guest = parseGuestForm(formData);
  const propertyIds = await ownedPropertyIds(
    session.user.id,
    guest.propertyScope === "some" ? guest.propertyIds : [],
  );

  await db.guest.update({
    where: { id: guestId },
    data: guestData(guest, propertyIds),
  });

  revalidatePath("/settings/guests");
  redirect("/settings/guests?saved=updated");
}

export async function pauseGuest(guestId: string) {
  const session = await requireSession();
  if (!(await getGuestForOwner(guestId, session.user.id))) {
    throw new Error("Guest not found");
  }
  await db.guest.update({
    where: { id: guestId },
    data: { pausedAt: new Date() },
  });
  revalidatePath("/settings/guests");
}

/** Resumes a paused guest — not one who opted out themselves. */
export async function resumeGuest(guestId: string) {
  const session = await requireSession();
  const guest = await getGuestForOwner(guestId, session.user.id);
  if (!guest) throw new Error("Guest not found");
  if (guest.optedOutAt) {
    throw new Error("This guest stopped reminders themselves");
  }
  await db.guest.update({ where: { id: guestId }, data: { pausedAt: null } });
  revalidatePath("/settings/guests");
}

export async function removeGuest(guestId: string) {
  const session = await requireSession();
  if (!(await getGuestForOwner(guestId, session.user.id))) {
    throw new Error("Guest not found");
  }
  await db.guest.update({
    where: { id: guestId },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/settings/guests");
}
