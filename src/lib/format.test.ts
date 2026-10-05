import {
  formatBillAmount,
  daysUntil,
  formatDate,
  formatDueIn,
  formatINR,
  formatShortDate,
  toDateInputValue,
} from "./format";

describe("formatINR", () => {
  it("formats whole rupee amounts with the ₹ symbol and no decimals", () => {
    expect(formatINR(1_000_000)).toBe("₹10,00,000");
  });

  it("rounds off fractional paise", () => {
    expect(formatINR(1234.56)).toBe("₹1,235");
  });

  it("formats zero", () => {
    expect(formatINR(0)).toBe("₹0");
  });

  it("formats negative amounts", () => {
    expect(formatINR(-500)).toBe("-₹500");
  });

  // Regression guard: Indian digit grouping is lakh/crore (2-digit groups
  // after the first 3), not the Western 3-digit grouping a naive formatter
  // (or the wrong locale) would produce.
  it("groups digits by lakh/crore, not by thousands", () => {
    expect(formatINR(100_000)).toBe("₹1,00,000");
    expect(formatINR(12_345_678)).toBe("₹1,23,45,678");
  });

  it("rounds 0.5 up and 0.4 down at the paise boundary", () => {
    expect(formatINR(0.5)).toBe("₹1");
    expect(formatINR(0.4)).toBe("₹0");
  });

  it("does not throw on NaN, rendering it inline instead", () => {
    expect(formatINR(NaN)).toBe("₹NaN");
  });

  it("formats a very large amount without switching to scientific notation", () => {
    expect(formatINR(999_999_999_999)).toBe("₹9,99,99,99,99,999");
  });
});

describe("formatDate", () => {
  it("formats a date as day, short month, year", () => {
    expect(formatDate(new Date(Date.UTC(2026, 2, 5)))).toMatch(/5 Mar 2026/);
  });

  it("formats single-digit days without a leading zero", () => {
    expect(formatDate(new Date(Date.UTC(2026, 0, 3)))).toMatch(/3 Jan 2026/);
  });

  it("formats a leap-day date", () => {
    expect(formatDate(new Date(Date.UTC(2028, 1, 29)))).toMatch(/29 Feb 2028/);
  });

  it("formats the last day of the year distinctly from the first", () => {
    expect(formatDate(new Date(Date.UTC(2025, 11, 31)))).toMatch(/31 Dec 2025/);
    expect(formatDate(new Date(Date.UTC(2026, 0, 1)))).toMatch(/1 Jan 2026/);
  });

  it("throws on an invalid Date rather than rendering garbage", () => {
    expect(() => formatDate(new Date("not-a-date"))).toThrow(
      /Invalid time value/,
    );
  });
});

describe("formatDate for timestamps", () => {
  it("shows the day an instant fell on in the given time zone", () => {
    // 20:00 UTC on 5 Oct is already 6 Oct in India.
    const instant = new Date("2026-10-05T20:00:00Z");
    expect(formatDate(instant)).toMatch(/5 Oct 2026/);
    expect(formatDate(instant, "Asia/Kolkata")).toMatch(/6 Oct 2026/);
  });
});

describe("toDateInputValue", () => {
  it("gives a stored date-only value's calendar day", () => {
    expect(toDateInputValue(new Date("2026-03-05"))).toBe("2026-03-05");
    expect(toDateInputValue(new Date("2026-01-03"))).toBe("2026-01-03");
  });

  it("round-trips what a date input submitted", () => {
    // A date input's "2026-03-05" is parsed by the server as midnight UTC;
    // prefilling the edit form must show the same day back.
    expect(toDateInputValue(new Date("2026-03-05"))).toBe("2026-03-05");
  });
});

describe("daysUntil and formatDueIn", () => {
  // 10:00 in India on 5 Oct.
  const now = new Date("2026-10-05T04:30:00Z");
  const day = (iso: string) => new Date(iso); // stored as midnight UTC

  it.each([
    ["2026-10-02", "Overdue 3 days"],
    ["2026-10-04", "Overdue 1 day"],
    ["2026-10-05", "Due today"],
    ["2026-10-06", "Tomorrow"],
    ["2026-10-10", "In 5 days"],
  ])("formats a due date of %p as %p", (due, expected) => {
    expect(formatDueIn(day(due), now)).toBe(expected);
  });

  it("only lets the user's time zone move 'today', never the due day", () => {
    // 02:00 UTC on 6 Oct: already 6 Oct in India, still 5 Oct in New York.
    const instant = new Date("2026-10-06T02:00:00Z");
    const due = day("2026-10-08");
    expect(daysUntil(due, instant, "Asia/Kolkata")).toBe(2);
    expect(daysUntil(due, instant, "America/New_York")).toBe(3);
    expect(daysUntil(due, instant, "Pacific/Kiritimati")).toBe(2);
  });

  it("defaults to the app's default time zone (India)", () => {
    const instant = new Date("2026-10-05T20:00:00Z"); // 6 Oct in India
    expect(daysUntil(day("2026-10-06"), instant)).toBe(0);
  });
});

describe("formatShortDate", () => {
  it("drops the year", () => {
    expect(formatShortDate(new Date("2026-10-05"))).toBe("5 Oct");
  });
});

describe("formatBillAmount", () => {
  it("marks estimates as approximate", () => {
    expect(formatBillAmount(4120, true)).toBe(`Approx. ${formatINR(4120)}`);
  });

  it("leaves exact amounts as plain rupees", () => {
    expect(formatBillAmount(4120, false)).toBe(formatINR(4120));
  });
});
