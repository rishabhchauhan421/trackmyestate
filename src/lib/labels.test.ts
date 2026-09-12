import {
  BillRecurrence,
  BillType,
  EventCategory,
  InvestmentType,
  LoanType,
  NotificationStatus,
  OwnershipType,
  PolicyStatus,
  PolicyType,
  PremiumFrequency,
  PropertyCategory,
  PropertyType,
} from "../../generated/prisma";
import {
  BILL_TYPE_LABELS,
  EVENT_CATEGORY_LABELS,
  FREQUENCY_LABELS,
  INVESTMENT_TYPE_LABELS,
  LOAN_TYPE_LABELS,
  NOTIFICATION_STATUS_LABELS,
  OWNERSHIP_TYPE_LABELS,
  POLICY_STATUS_LABELS,
  POLICY_TYPE_LABELS,
  PROPERTY_CATEGORY_LABELS,
  PROPERTY_TYPE_LABELS,
  UTILITY_RECURRENCE_LABELS,
} from "./labels";

// These guard against schema/label drift: if an enum gains or loses a value
// in prisma/schema.prisma without the matching label map being updated, the
// UI would render "undefined" instead of a proper label (this happened once
// already when BillType.INTERNET and PaymentStatus.CANCELLED/REFUNDED were
// added directly to the schema).
describe("label maps stay in sync with their Prisma enums", () => {
  it("BILL_TYPE_LABELS covers every BillType value", () => {
    expect(Object.keys(BILL_TYPE_LABELS).sort()).toEqual(
      Object.values(BillType).sort(),
    );
  });

  it("FREQUENCY_LABELS covers every PremiumFrequency value", () => {
    expect(Object.keys(FREQUENCY_LABELS).sort()).toEqual(
      Object.values(PremiumFrequency).sort(),
    );
  });

  it("UTILITY_RECURRENCE_LABELS covers every BillRecurrence value", () => {
    expect(Object.keys(UTILITY_RECURRENCE_LABELS).sort()).toEqual(
      Object.values(BillRecurrence).sort(),
    );
  });

  it("INVESTMENT_TYPE_LABELS covers every InvestmentType value", () => {
    expect(Object.keys(INVESTMENT_TYPE_LABELS).sort()).toEqual(
      Object.values(InvestmentType).sort(),
    );
  });

  it("LOAN_TYPE_LABELS covers every LoanType value", () => {
    expect(Object.keys(LOAN_TYPE_LABELS).sort()).toEqual(
      Object.values(LoanType).sort(),
    );
  });

  it("PROPERTY_TYPE_LABELS covers every PropertyType value", () => {
    expect(Object.keys(PROPERTY_TYPE_LABELS).sort()).toEqual(
      Object.values(PropertyType).sort(),
    );
  });

  it("PROPERTY_CATEGORY_LABELS covers every PropertyCategory value", () => {
    expect(Object.keys(PROPERTY_CATEGORY_LABELS).sort()).toEqual(
      Object.values(PropertyCategory).sort(),
    );
  });

  it("OWNERSHIP_TYPE_LABELS covers every OwnershipType value", () => {
    expect(Object.keys(OWNERSHIP_TYPE_LABELS).sort()).toEqual(
      Object.values(OwnershipType).sort(),
    );
  });

  it("POLICY_TYPE_LABELS covers every PolicyType value", () => {
    expect(Object.keys(POLICY_TYPE_LABELS).sort()).toEqual(
      Object.values(PolicyType).sort(),
    );
  });

  it("POLICY_STATUS_LABELS covers every PolicyStatus value", () => {
    expect(Object.keys(POLICY_STATUS_LABELS).sort()).toEqual(
      Object.values(PolicyStatus).sort(),
    );
  });

  it("EVENT_CATEGORY_LABELS covers every EventCategory value", () => {
    expect(Object.keys(EVENT_CATEGORY_LABELS).sort()).toEqual(
      Object.values(EventCategory).sort(),
    );
  });

  it("NOTIFICATION_STATUS_LABELS covers every NotificationStatus value", () => {
    expect(Object.keys(NOTIFICATION_STATUS_LABELS).sort()).toEqual(
      Object.values(NotificationStatus).sort(),
    );
  });

  // A copy-paste slip (e.g. two keys sharing one label, or a label left as
  // an empty string) wouldn't be caught by the key-coverage checks above.
  it.each([
    ["BILL_TYPE_LABELS", BILL_TYPE_LABELS],
    ["FREQUENCY_LABELS", FREQUENCY_LABELS],
    ["UTILITY_RECURRENCE_LABELS", UTILITY_RECURRENCE_LABELS],
    ["INVESTMENT_TYPE_LABELS", INVESTMENT_TYPE_LABELS],
    ["LOAN_TYPE_LABELS", LOAN_TYPE_LABELS],
    ["PROPERTY_TYPE_LABELS", PROPERTY_TYPE_LABELS],
    ["PROPERTY_CATEGORY_LABELS", PROPERTY_CATEGORY_LABELS],
    ["OWNERSHIP_TYPE_LABELS", OWNERSHIP_TYPE_LABELS],
    ["POLICY_TYPE_LABELS", POLICY_TYPE_LABELS],
    ["POLICY_STATUS_LABELS", POLICY_STATUS_LABELS],
    ["EVENT_CATEGORY_LABELS", EVENT_CATEGORY_LABELS],
    ["NOTIFICATION_STATUS_LABELS", NOTIFICATION_STATUS_LABELS],
  ] as const)("%s has no blank or duplicate label values", (_name, map) => {
    const values = Object.values(map);
    for (const value of values) {
      expect(value.trim()).not.toBe("");
    }
    expect(new Set(values).size).toBe(values.length);
  });
});
