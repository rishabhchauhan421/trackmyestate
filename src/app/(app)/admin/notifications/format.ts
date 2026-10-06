import { DEFAULT_TIME_ZONE } from "~/lib/time-zone";

/** "6 Oct, 9:00 am" in the admin's reference time zone (IST). */
export function formatDateTime(date: Date, withYear = false) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: DEFAULT_TIME_ZONE,
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export const CHANNEL_LABELS: Record<string, string> = {
  EMAIL: "Email",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
  PUSH: "Push",
};

export const ROLE_LABELS = {
  owner: "Owner",
  guest: "Guest",
  recipient: "Bill recipient",
} as const;
