import { addDays, addMonths, calendarDayOf, dateOnly } from "./calendar-day";

describe("calendar days", () => {
  it("stores a day as midnight UTC — what a date input parses to", () => {
    expect(dateOnly("2026-10-08")).toEqual(new Date("2026-10-08"));
    expect(dateOnly("2026-10-08").toISOString()).toBe(
      "2026-10-08T00:00:00.000Z",
    );
  });

  it("round-trips without depending on any time zone", () => {
    for (const day of [
      "2026-01-01",
      "2026-02-28",
      "2028-02-29",
      "2026-12-31",
    ]) {
      expect(calendarDayOf(dateOnly(day))).toBe(day);
    }
  });

  it.each(["2026-13-01", "2026-02-30", "8 Oct 2026", "", "2026-1-5"])(
    "rejects %p",
    (day) => {
      expect(() => dateOnly(day)).toThrow("Not a calendar day");
    },
  );

  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("adds months on the same day of the month", () => {
    expect(addMonths("2026-10-05", 1)).toBe("2026-11-05");
    expect(addMonths("2026-10-05", -10)).toBe("2025-12-05");
  });
});
