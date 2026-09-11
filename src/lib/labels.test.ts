import {
  BillType,
  PremiumFrequency,
  UtilityRecurrence,
} from "../../generated/prisma";
import {
  BILL_TYPE_LABELS,
  FREQUENCY_LABELS,
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

  it("UTILITY_RECURRENCE_LABELS covers every UtilityRecurrence value", () => {
    expect(Object.keys(UTILITY_RECURRENCE_LABELS).sort()).toEqual(
      Object.values(UtilityRecurrence).sort(),
    );
  });

  // A copy-paste slip (e.g. two keys sharing one label, or a label left as
  // an empty string) wouldn't be caught by the key-coverage checks above.
  it.each([
    ["BILL_TYPE_LABELS", BILL_TYPE_LABELS],
    ["FREQUENCY_LABELS", FREQUENCY_LABELS],
    ["UTILITY_RECURRENCE_LABELS", UTILITY_RECURRENCE_LABELS],
  ] as const)("%s has no blank or duplicate label values", (_name, map) => {
    const values = Object.values(map);
    for (const value of values) {
      expect(value.trim()).not.toBe("");
    }
    expect(new Set(values).size).toBe(values.length);
  });
});
