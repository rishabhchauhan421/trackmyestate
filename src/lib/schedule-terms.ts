/**
 * The `BillSchedule` terms (when bills fall due, and for how much) that
 * each kind of asset describes. Pure, so the asset actions and their tests
 * share one answer.
 */
import type { BillRecurrence, PremiumFrequency } from "../../generated/prisma";

/** When a schedule's bills fall due, and for how much. */
export interface ScheduleTerms {
  recurrence: BillRecurrence;
  startDate: Date;
  dueDay: number;
  dueMonth?: number | null;
  endDate?: Date | null;
  tenureMonths?: number | null;
  defaultAmount: number;
}

/** A single bill on `date` (a maturity, a payout, a one-time premium). */
export function oneOffTerms(date: Date, amount: number): ScheduleTerms {
  return {
    // One year's worth of a yearly schedule is exactly one occurrence.
    recurrence: "YEARLY",
    startDate: date,
    dueDay: date.getUTCDate(),
    dueMonth: date.getUTCMonth() + 1,
    tenureMonths: 12,
    defaultAmount: amount,
  };
}

const PREMIUM_RECURRENCE: Record<
  Exclude<PremiumFrequency, "SINGLE">,
  BillRecurrence
> = {
  MONTHLY: "MONTHLY",
  QUARTERLY: "QUARTERLY",
  HALF_YEARLY: "HALF_YEARLY",
  YEARLY: "YEARLY",
};

/**
 * A policy's premiums: from the next premium date, every period, until
 * the policy's term ends (if it has one).
 */
export function premiumTerms(
  frequency: PremiumFrequency,
  nextPremiumDate: Date,
  amount: number,
  policyEnd: Date | null = null,
): ScheduleTerms {
  if (frequency === "SINGLE") return oneOffTerms(nextPremiumDate, amount);
  const recurrence = PREMIUM_RECURRENCE[frequency];
  return {
    recurrence,
    startDate: nextPremiumDate,
    dueDay: nextPremiumDate.getUTCDate(),
    dueMonth:
      recurrence === "YEARLY" ? nextPremiumDate.getUTCMonth() + 1 : null,
    endDate: policyEnd,
    defaultAmount: amount,
  };
}

/** The day a policy's term ends: `tenureYears` after it started. */
export function policyEndDate(
  startDate: Date,
  tenureYears: number | null,
): Date | null {
  if (!tenureYears) return null;
  const end = new Date(startDate);
  end.setUTCFullYear(end.getUTCFullYear() + tenureYears);
  end.setUTCDate(end.getUTCDate() - 1);
  return end;
}

/**
 * What an investment is expected to pay back on its return date: its
 * current estimate if the owner gave one, else the capital grown by the
 * target return, else the capital itself. Minor units.
 */
export function expectedReturnAmount(investment: {
  capitalDeployed: number;
  targetRoiPercent: number | null;
  currentEstimatedValue: number | null;
}): number {
  if (investment.currentEstimatedValue != null) {
    return investment.currentEstimatedValue;
  }
  if (investment.targetRoiPercent != null) {
    return Math.round(
      investment.capitalDeployed * (1 + investment.targetRoiPercent / 100),
    );
  }
  return investment.capitalDeployed;
}
