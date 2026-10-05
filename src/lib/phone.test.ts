import { formatPhone, localMobileDigits, normalizeIndianMobile } from "./phone";

describe("normalizeIndianMobile", () => {
  it.each([
    "9876543210",
    "98765 43210",
    "98765-43210",
    "+91 98765 43210",
    "+919876543210",
    "919876543210",
    "09876543210",
  ])("accepts %p", (input) => {
    expect(normalizeIndianMobile(input)).toBe("+919876543210");
  });

  it.each([
    "",
    "12345",
    "5876543210",
    "98765432101",
    "+1 415 555 0100",
    "abcdefghij",
  ])("rejects %p", (input) => {
    expect(normalizeIndianMobile(input)).toBeNull();
  });
});

describe("formatPhone", () => {
  it("groups an Indian number", () => {
    expect(formatPhone("+919876543210")).toBe("+91 98765 43210");
  });

  it("leaves anything else alone", () => {
    expect(formatPhone("+14155550100")).toBe("+14155550100");
  });
});

describe("localMobileDigits", () => {
  it("strips the country code", () => {
    expect(localMobileDigits("+919876543210")).toBe("9876543210");
    expect(localMobileDigits(null)).toBe("");
  });
});
