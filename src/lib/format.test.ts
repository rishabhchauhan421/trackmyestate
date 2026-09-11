import { formatDate, formatINR } from "./format";

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
    expect(formatDate(new Date(Date.UTC(2026, 2, 5)))).toMatch(
      /5 Mar 2026/,
    );
  });

  it("formats single-digit days without a leading zero", () => {
    expect(formatDate(new Date(Date.UTC(2026, 0, 3)))).toMatch(/3 Jan 2026/);
  });

  it("formats a leap-day date", () => {
    expect(formatDate(new Date(Date.UTC(2028, 1, 29)))).toMatch(
      /29 Feb 2028/,
    );
  });

  it("formats the last day of the year distinctly from the first", () => {
    expect(formatDate(new Date(Date.UTC(2025, 11, 31)))).toMatch(
      /31 Dec 2025/,
    );
    expect(formatDate(new Date(Date.UTC(2026, 0, 1)))).toMatch(
      /1 Jan 2026/,
    );
  });

  it("throws on an invalid Date rather than rendering garbage", () => {
    expect(() => formatDate(new Date("not-a-date"))).toThrow(
      /Invalid time value/,
    );
  });
});
