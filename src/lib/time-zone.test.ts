import {
  DEFAULT_TIME_ZONE,
  isValidTimeZone,
  normalizeTimeZone,
  resolveTimeZone,
  timeZoneOffsetLabel,
  timeZoneOptions,
  todayInTimeZone,
  zonedTimeToUtc,
  daysBetween,
} from "./time-zone";

describe("isValidTimeZone", () => {
  it.each(["Asia/Kolkata", "America/New_York", "UTC", "Asia/Calcutta"])(
    "accepts %p",
    (zone) => expect(isValidTimeZone(zone)).toBe(true),
  );

  it.each(["", "Mars/Olympus_Mons", "GMT+25", "not a zone"])(
    "rejects %p",
    (zone) => expect(isValidTimeZone(zone)).toBe(false),
  );
});

describe("normalizeTimeZone", () => {
  it("maps legacy names to current ones", () => {
    expect(normalizeTimeZone("Asia/Calcutta")).toBe("Asia/Kolkata");
    expect(normalizeTimeZone("Europe/Kiev")).toBe("Europe/Kyiv");
  });

  it("leaves current names alone", () => {
    expect(normalizeTimeZone("Europe/London")).toBe("Europe/London");
  });
});

describe("resolveTimeZone", () => {
  it("falls back to the default when unset or unknown", () => {
    expect(resolveTimeZone(null)).toBe(DEFAULT_TIME_ZONE);
    expect(resolveTimeZone(undefined)).toBe(DEFAULT_TIME_ZONE);
    expect(resolveTimeZone("Nowhere/Land")).toBe(DEFAULT_TIME_ZONE);
  });

  it("returns a valid zone, normalised", () => {
    expect(resolveTimeZone("Asia/Calcutta")).toBe("Asia/Kolkata");
    expect(resolveTimeZone("Asia/Dubai")).toBe("Asia/Dubai");
  });
});

describe("timeZoneOffsetLabel", () => {
  it("formats the offset", () => {
    expect(timeZoneOffsetLabel("Asia/Kolkata")).toBe("GMT+05:30");
  });

  it("reflects daylight saving at the given moment", () => {
    expect(
      timeZoneOffsetLabel("America/New_York", new Date("2026-01-15T12:00Z")),
    ).toBe("GMT-05:00");
    expect(
      timeZoneOffsetLabel("America/New_York", new Date("2026-07-15T12:00Z")),
    ).toBe("GMT-04:00");
  });
});

describe("timeZoneOptions", () => {
  const options = timeZoneOptions(new Date("2026-01-15T12:00Z"));
  const values = options.map((option) => option.value);

  it("includes the default and UTC, using current names only", () => {
    expect(values).toContain("Asia/Kolkata");
    expect(values).toContain("UTC");
    expect(values).not.toContain("Asia/Calcutta");
    expect(new Set(values).size).toBe(values.length);
  });

  it("labels each zone with its offset", () => {
    expect(options.find((o) => o.value === "Asia/Kolkata")?.label).toBe(
      "(GMT+05:30) Asia/Kolkata",
    );
  });

  it("orders zones west to east", () => {
    expect(values.indexOf("America/New_York")).toBeLessThan(
      values.indexOf("Europe/London"),
    );
    expect(values.indexOf("Europe/London")).toBeLessThan(
      values.indexOf("Asia/Kolkata"),
    );
  });
});

describe("todayInTimeZone", () => {
  // 20:00 UTC on 5 Oct is already 6 Oct in India, still 5 Oct in New York.
  const now = new Date("2026-10-05T20:00:00Z");

  it("uses the zone's calendar date, not the server's", () => {
    expect(todayInTimeZone("Asia/Kolkata", now)).toBe("2026-10-06");
    expect(todayInTimeZone("America/New_York", now)).toBe("2026-10-05");
  });
});

describe("zonedTimeToUtc", () => {
  it("converts a local wall-clock time to the matching instant", () => {
    expect(
      zonedTimeToUtc("2026-10-05", 9, 0, "Asia/Kolkata").toISOString(),
    ).toBe("2026-10-05T03:30:00.000Z");
    expect(zonedTimeToUtc("2026-10-05", 9, 0, "UTC").toISOString()).toBe(
      "2026-10-05T09:00:00.000Z",
    );
  });

  it("uses the offset in force on that day (daylight saving)", () => {
    expect(
      zonedTimeToUtc("2026-01-15", 9, 0, "America/New_York").toISOString(),
    ).toBe("2026-01-15T14:00:00.000Z");
    expect(
      zonedTimeToUtc("2026-07-15", 9, 0, "America/New_York").toISOString(),
    ).toBe("2026-07-15T13:00:00.000Z");
  });
});

describe("daysBetween", () => {
  it("counts calendar days, signed", () => {
    expect(daysBetween("2026-10-05", "2026-10-08")).toBe(3);
    expect(daysBetween("2026-10-08", "2026-10-05")).toBe(-3);
    expect(daysBetween("2026-10-05", "2026-10-05")).toBe(0);
    expect(daysBetween("2026-02-27", "2026-03-01")).toBe(2);
  });
});
