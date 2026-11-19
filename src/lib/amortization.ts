/**
 * How each EMI of a reducing-balance loan splits into interest and
 * principal. Interest for a month is the balance owed times the monthly
 * rate; the rest of the EMI repays principal. All amounts are in minor
 * units (paise), rounded to whole paise each month like a bank statement.
 */

export interface AmortizationRow {
  installment: number;
  interest: number;
  principal: number;
  /** What's still owed after this EMI. */
  balanceAfter: number;
}

/**
 * The split of EMI number `installment` (1-based) for a loan of
 * `principal` at `annualRatePercent`, repaid at `emi` a month. The last
 * EMIs only repay what's left, so principal never goes below zero.
 */
export function amortizationRow(
  principal: number,
  annualRatePercent: number,
  emi: number,
  installment: number,
): AmortizationRow {
  const monthlyRate = annualRatePercent / 12 / 100;
  let balance = principal;
  let row: AmortizationRow = {
    installment: 0,
    interest: 0,
    principal: 0,
    balanceAfter: balance,
  };
  for (let n = 1; n <= installment; n++) {
    const interest = Math.round(balance * monthlyRate);
    const repaid = Math.min(Math.max(emi - interest, 0), balance);
    balance -= repaid;
    row = {
      installment: n,
      interest,
      principal: repaid,
      balanceAfter: balance,
    };
  }
  return row;
}
