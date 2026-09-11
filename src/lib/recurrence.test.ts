import { advanceByRecurrence } from "./recurrence";

describe("advanceByRecurrence", () => {
  it("advances WEEKLY by 7 days", () => {
    expect(advanceByRecurrence(new Date(2026, 5, 10), "WEEKLY")).toEqual(
      new Date(2026, 5, 17),
    );
  });

  it("advances BI_WEEKLY by 14 days", () => {
    expect(advanceByRecurrence(new Date(2026, 5, 10), "BI_WEEKLY")).toEqual(
      new Date(2026, 5, 24),
    );
  });

  it("advances MONTHLY by 1 month", () => {
    expect(advanceByRecurrence(new Date(2026, 5, 10), "MONTHLY")).toEqual(
      new Date(2026, 6, 10),
    );
  });

  it("advances QUARTERLY by 3 months", () => {
    expect(advanceByRecurrence(new Date(2026, 5, 10), "QUARTERLY")).toEqual(
      new Date(2026, 8, 10),
    );
  });

  it("advances HALF_YEARLY by 6 months", () => {
    expect(advanceByRecurrence(new Date(2026, 5, 10), "HALF_YEARLY")).toEqual(
      new Date(2026, 11, 10),
    );
  });

  it("advances YEARLY by 1 year", () => {
    expect(advanceByRecurrence(new Date(2026, 5, 10), "YEARLY")).toEqual(
      new Date(2027, 5, 10),
    );
  });

  it("does not mutate the input date", () => {
    const original = new Date(2026, 5, 10);
    const originalTime = original.getTime();

    advanceByRecurrence(original, "MONTHLY");

    expect(original.getTime()).toBe(originalTime);
  });

  // JS Date.setMonth() overflows into the following month when the target
  // month is shorter than the current day-of-month (Feb has no 31st). This
  // documents the real behavior rather than a hoped-for "clamp to Feb 28".
  it("rolls a month-end MONTHLY date over when the next month is shorter", () => {
    const expected = new Date(2026, 0, 31);
    expected.setMonth(1);

    expect(advanceByRecurrence(new Date(2026, 0, 31), "MONTHLY")).toEqual(
      expected,
    );
  });

  it("advances a leap-day YEARLY date into a non-leap year", () => {
    const expected = new Date(2028, 1, 29);
    expected.setFullYear(2029);

    expect(advanceByRecurrence(new Date(2028, 1, 29), "YEARLY")).toEqual(
      expected,
    );
  });
});
