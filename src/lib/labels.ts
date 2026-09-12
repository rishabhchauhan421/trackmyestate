/**
 * Human-readable labels for Prisma enums used in the UI. Each map is typed
 * as `Record<Enum, string>` so TypeScript itself enforces coverage — adding
 * an enum value without adding its label here is a compile error. See
 * `labels.test.ts` for the runtime drift guard (values, not just keys).
 */
import type {
  BillRecurrence,
  BillType,
  EventCategory,
  InvestmentType,
  LoanType,
  NotificationStatus,
  PolicyStatus,
  PolicyType,
  PremiumFrequency,
  PropertyType,
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

/** Display label for each `BillRecurrence` (how often a utility bill cycle repeats). */
export const UTILITY_RECURRENCE_LABELS: Record<BillRecurrence, string> = {
  WEEKLY: "Weekly",
  BI_WEEKLY: "Every 2 weeks",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  HALF_YEARLY: "Half-yearly",
  YEARLY: "Yearly",
};

/** Display label for each `InvestmentType`. */
export const INVESTMENT_TYPE_LABELS: Record<InvestmentType, string> = {
  PROPERTY: "Property",
  FIXED_DEPOSIT: "Fixed deposit",
  RECURRING_DEPOSIT: "Recurring deposit",
  MUTUAL_FUND: "Mutual fund",
  STOCKS: "Stocks",
  GOLD: "Gold",
  BUSINESS: "Business",
  PPF: "PPF",
  NPS: "NPS",
};

/** Display label for each `LoanType`. */
export const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  HOME_LOAN: "Home loan",
  LOAN_AGAINST_PROPERTY: "Loan against property",
  PERSONAL_LOAN: "Personal loan",
  VEHICLE_LOAN: "Vehicle loan",
  EDUCATION_LOAN: "Education loan",
  GOLD_LOAN: "Gold loan",
};

/** Display label for each `PropertyType`. */
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  SELF_OCCUPIED: "Self-occupied",
  RENTED: "Rented",
  UNDER_CONSTRUCTION: "Under construction",
  INVESTMENT: "Investment",
};

/** Display label for each `PolicyType`. */
export const POLICY_TYPE_LABELS: Record<PolicyType, string> = {
  TERM_LIFE: "Term life",
  ENDOWMENT: "Endowment",
  MONEY_BACK: "Money back",
  ULIP: "ULIP",
  HEALTH: "Health",
  VEHICLE: "Vehicle",
  HOME: "Home",
};

/** Display label for each `PolicyStatus`. */
export const POLICY_STATUS_LABELS: Record<PolicyStatus, string> = {
  ACTIVE: "Active",
  LAPSED: "Lapsed",
  MATURED: "Matured",
  CLAIMED: "Claimed",
  CANCELLED: "Cancelled",
};

/** Display label for each `EventCategory` (what kind of bill/financial event a `Bill` row represents). */
export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  RENT: "Rent",
  UTILITY_BILL: "Utility bill",
  PREMIUM: "Premium",
  EMI: "EMI",
  INVESTMENT_RETURN: "Investment return",
  PAYOUT: "Payout",
  CLAIM_SETTLEMENT: "Claim settlement",
  CUSTOM: "Custom",
};

/** Display label for each `NotificationStatus` (used on the admin overview's notification-engine health tiles). */
export const NOTIFICATION_STATUS_LABELS: Record<NotificationStatus, string> = {
  SCHEDULED: "Scheduled",
  PROCESSING: "Processing",
  SENT: "Sent",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  SKIPPED: "Skipped",
};
