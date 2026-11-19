import {
  addTotals,
  amountIn,
  formatTotals,
  hasNegative,
  isZeroTotal,
  sumByCurrency,
} from "./money-totals";

describe("sumByCurrency", () => {
  it("keeps one sum per currency, counting a missing currency as the user's", () => {
    expect(
      sumByCurrency(
        [
          { amount: 100_00, currency: "INR" },
          { amount: 50_00, currency: null },
          { amount: 20_00, currency: "USD" },
          { amount: null, currency: "USD" },
        ],
        "INR",
      ),
    ).toEqual({ INR: 150_00, USD: 20_00 });
  });
});

describe("addTotals", () => {
  it("adds or subtracts per currency", () => {
    expect(addTotals({ INR: 100, USD: 5 }, { INR: 30, EUR: 2 }, -1)).toEqual({
      INR: 70,
      USD: 5,
      EUR: -2,
    });
  });
});

describe("formatTotals", () => {
  it("shows the user's currency first, then the others", () => {
    expect(formatTotals({ USD: 4_000_00, INR: 12_00_000_00 }, "INR")).toBe(
      "₹12,00,000 + $4,000",
    );
  });

  it("shows nothing as zero in the user's currency", () => {
    expect(formatTotals({}, "USD")).toBe("$0");
    expect(formatTotals({ INR: 0 }, "INR")).toBe("₹0");
  });

  it("signs negative parts, and every part when asked", () => {
    expect(formatTotals({ INR: -5_000_00 }, "INR")).toBe("−₹5,000");
    expect(
      formatTotals({ INR: 5_000_00, USD: -200_00 }, "INR", { signed: true }),
    ).toBe("+₹5,000 − $200");
  });
});

describe("helpers", () => {
  it("reads one currency, and spots zero and negative totals", () => {
    expect(amountIn({ INR: 5 }, "USD")).toBe(0);
    expect(isZeroTotal({ INR: 0 })).toBe(true);
    expect(hasNegative({ INR: 5, USD: -1 })).toBe(true);
  });
});
