import { amortizationRow } from "./amortization";

// ₹10,00,000 at 12% a year over 12 months: EMI ₹88,848.79.
const PRINCIPAL = 100_000_000;
const EMI = 8_884_879;

describe("amortizationRow", () => {
  it("charges a month's interest on the full principal first", () => {
    expect(amortizationRow(PRINCIPAL, 12, EMI, 1)).toEqual({
      installment: 1,
      interest: 1_000_000,
      principal: 7_884_879,
      balanceAfter: 92_115_121,
    });
  });

  it("charges less interest as the balance falls", () => {
    const second = amortizationRow(PRINCIPAL, 12, EMI, 2);
    expect(second.interest).toBe(921_151);
    expect(second.principal).toBe(EMI - 921_151);
  });

  it("repays the loan by the last EMI", () => {
    const last = amortizationRow(PRINCIPAL, 12, EMI, 12);
    expect(last.balanceAfter).toBeLessThanOrEqual(12);
    expect(amortizationRow(PRINCIPAL, 12, EMI, 13).principal).toBe(
      last.balanceAfter,
    );
  });

  it("is all principal on an interest-free loan", () => {
    expect(amortizationRow(1_200_000, 0, 100_000, 3)).toEqual({
      installment: 3,
      interest: 0,
      principal: 100_000,
      balanceAfter: 900_000,
    });
  });
});
