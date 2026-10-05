/**
 * IANA time zone helpers, shared by the Settings form (client) and the
 * server. A user's zone decides when reminders go out and what "today"
 * means for them.
 */

/** Used when a user hasn't picked a time zone — most users are in India. */
export const DEFAULT_TIME_ZONE = "Asia/Kolkata";

/**
 * Legacy names some ICU builds (Node's included) still report, mapped to
 * the current IANA names, so the list, a browser's detected zone and the
 * saved value always agree.
 */
const LEGACY_ALIASES: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Rangoon": "Asia/Yangon",
  "Europe/Kiev": "Europe/Kyiv",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "America/Godthab": "America/Nuuk",
  "Pacific/Truk": "Pacific/Chuuk",
  "Pacific/Ponape": "Pacific/Pohnpei",
  "Pacific/Enderbury": "Pacific/Kanton",
};

export function normalizeTimeZone(timeZone: string) {
  return LEGACY_ALIASES[timeZone] ?? timeZone;
}

/** Whether the runtime recognises `timeZone` as an IANA zone. */
export function isValidTimeZone(timeZone: string) {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** A user's zone, falling back to the default when unset or unknown. */
export function resolveTimeZone(timeZone: string | null | undefined) {
  return timeZone && isValidTimeZone(timeZone)
    ? normalizeTimeZone(timeZone)
    : DEFAULT_TIME_ZONE;
}

/** "GMT+05:30" (or "GMT" for UTC) — the zone's offset at `at`. */
export function timeZoneOffsetLabel(timeZone: string, at = new Date()) {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? "GMT";
}

/** Minutes east of UTC at `at`, for sorting. */
function offsetMinutes(timeZone: string, at: Date) {
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(
    timeZoneOffsetLabel(timeZone, at),
  );
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === "-" ? -minutes : minutes;
}

export type TimeZoneOption = { value: string; label: string };

/**
 * Every zone the runtime knows, as "(GMT+05:30) Asia/Kolkata", ordered by
 * current offset then name. Offsets reflect `at`, so daylight-saving zones
 * show their offset today.
 */
export function timeZoneOptions(at = new Date()): TimeZoneOption[] {
  const zones = new Set(
    [...Intl.supportedValuesOf("timeZone"), "UTC", DEFAULT_TIME_ZONE].map(
      normalizeTimeZone,
    ),
  );
  return [...zones]
    .filter(isValidTimeZone)
    .map((zone) => ({ zone, offset: offsetMinutes(zone, at) }))
    .sort((a, b) => a.offset - b.offset || a.zone.localeCompare(b.zone))
    .map(({ zone }) => ({
      value: zone,
      label: `(${timeZoneOffsetLabel(zone, at)}) ${zone.replaceAll("_", " ")}`,
    }));
}

/** Today's date in `timeZone`, as "YYYY-MM-DD" (the date input format). */
export function todayInTimeZone(timeZone: string, now = new Date()) {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * The instant that is `hour:minute` on calendar day `day` ("YYYY-MM-DD")
 * in `timeZone` — e.g. 09:00 in Asia/Kolkata on 2026-10-05 is 03:30 UTC.
 * Corrects once for the zone's offset on that day, so it's right across
 * daylight-saving changes (except inside a skipped/repeated hour).
 */
export function zonedTimeToUtc(
  day: string,
  hour: number,
  minute: number,
  timeZone: string,
) {
  const [year, month, date] = day.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const asIfUtc = Date.UTC(year, month - 1, date, hour, minute);
  const firstGuess =
    asIfUtc - offsetMinutes(timeZone, new Date(asIfUtc)) * 60_000;
  return new Date(
    asIfUtc - offsetMinutes(timeZone, new Date(firstGuess)) * 60_000,
  );
}

/** Whole days from calendar day `from` to `to` (both "YYYY-MM-DD"). */
export function daysBetween(from: string, to: string) {
  const toUtc = (day: string) => {
    const [y, m, d] = day.split("-").map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}
