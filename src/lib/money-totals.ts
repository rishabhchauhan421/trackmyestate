/**
 * Totals of amounts that may be in different currencies. Until there's
 * conversion, amounts in different currencies are never added together: a
 * total is one sum per currency, shown as "₹12,00,000 + $4,000".
 *
 * A record without a currency counts in the user's (`fallback`).
 */
import type { Currency } from "../../generated/prisma";
import { formatMoney } from "./format";

export type MoneyTotals = Partial<Record<Currency, number>>;

/** Sums `items` per currency. */
export function sumByCurrency(
  items: readonly {
    amount: number | null | undefined;
    currency: Currency | null | undefined;
  }[],
  fallback: Currency,
): MoneyTotals {
  const totals: MoneyTotals = {};
  for (const { amount, currency } of items) {
    if (amount == null) continue;
    const code = currency ?? fallback;
    totals[code] = (totals[code] ?? 0) + amount;
  }
  return totals;
}

/** `a + b`, or `a − b` with `sign` -1, per currency. */
export function addTotals(
  a: MoneyTotals,
  b: MoneyTotals,
  sign: 1 | -1 = 1,
): MoneyTotals {
  const totals: MoneyTotals = { ...a };
  for (const [code, amount] of Object.entries(b) as [Currency, number][]) {
    totals[code] = (totals[code] ?? 0) + sign * amount;
  }
  return totals;
}

/** The currencies with a non-zero total, the user's own first. */
function nonZero(totals: MoneyTotals, fallback: Currency) {
  return (Object.entries(totals) as [Currency, number][])
    .filter(([, amount]) => amount !== 0)
    .sort(([a], [b]) =>
      a === fallback ? -1 : b === fallback ? 1 : a.localeCompare(b),
    );
}

export function isZeroTotal(totals: MoneyTotals) {
  return Object.values(totals).every((amount) => amount === 0);
}

/** Whether any total is below zero (e.g. a net worth). */
export function hasNegative(totals: MoneyTotals) {
  return Object.values(totals).some((amount) => amount < 0);
}

/**
 * "₹12,00,000", or "₹12,00,000 + $4,000" across currencies; "₹0" (in the
 * user's currency) when there's nothing. With `signed`, each part carries
 * its own + or − ("+₹5,000 − $200").
 */
export function formatTotals(
  totals: MoneyTotals,
  fallback: Currency,
  { signed = false }: { signed?: boolean } = {},
): string {
  const parts = nonZero(totals, fallback);
  if (parts.length === 0) return formatMoney(0, fallback);
  return parts
    .map(([code, amount], index) => {
      const money = formatMoney(Math.abs(amount), code);
      const sign = amount < 0 ? "−" : signed || index > 0 ? "+" : "";
      if (index === 0) {
        return amount < 0 || signed ? `${sign}${money}` : money;
      }
      return `${sign} ${money}`;
    })
    .join(" ");
}

/** The part of `totals` in `currency` — e.g. to size a bar chart. */
export function amountIn(totals: MoneyTotals, currency: Currency): number {
  return totals[currency] ?? 0;
}
