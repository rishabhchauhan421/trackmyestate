/**
 * Human-readable labels for Prisma enums used in the UI. Each map is typed
 * as `Record<Enum, string>` so TypeScript itself enforces coverage — adding
 * an enum value without adding its label here is a compile error. See
 * `labels.test.ts` for the runtime drift guard (values, not just keys).
 */
import type {
  BillType,
  PremiumFrequency,
  UtilityRecurrence,
} from "../../generated/prisma";

/** Display label for each `BillType` (used for both `Utility.type` and, historically, direct bills). */
export const BILL_TYPE_LABELS: Record<BillType, string> = {
  ELECTRICITY: "Electricity",
  WATER: "Water",
  PROPERTY_TAX: "Property tax",
  MAINTENANCE: "Maintenance",
  GAS: "Gas",
  INTERNET: "Internet",
  OTHER: "Other",
};

/** Display label for each `PremiumFrequency` (insurance premium payment cadence). */
export const FREQUENCY_LABELS: Record<PremiumFrequency, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  HALF_YEARLY: "Half-yearly",
  YEARLY: "Yearly",
  SINGLE: "One-time",
};

/** Display label for each `UtilityRecurrence` (how often a utility bill cycle repeats). */
export const UTILITY_RECURRENCE_LABELS: Record<UtilityRecurrence, string> = {
  WEEKLY: "Weekly",
  BI_WEEKLY: "Every 2 weeks",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  HALF_YEARLY: "Half-yearly",
  YEARLY: "Yearly",
};
