import { fromMinorUnits, optionalFromMinorUnits, toMinorUnits } from "./money";

describe("toMinorUnits", () => {
  it("converts rupees to whole paise", () => {
    expect(toMinorUnits(1500)).toBe(150_000);
    expect(toMinorUnits(0.1 + 0.2)).toBe(30);
    expect(toMinorUnits(1234.56)).toBe(123_456);
  });

  it("rounds half away from zero, despite float representation", () => {
    expect(toMinorUnits(1.005)).toBe(101);
    expect(toMinorUnits(-1.005)).toBe(-101);
    expect(toMinorUnits(2.004)).toBe(200);
  });

  it("is exact for large amounts", () => {
    expect(toMinorUnits(50_000_000)).toBe(5_000_000_000);
  });
});

describe("fromMinorUnits", () => {
  it("converts paise back to rupees", () => {
    expect(fromMinorUnits(150_000)).toBe(1500);
    expect(fromMinorUnits(123_456)).toBe(1234.56);
  });

  it("passes missing amounts through", () => {
    expect(optionalFromMinorUnits(null)).toBeUndefined();
    expect(optionalFromMinorUnits(undefined)).toBeUndefined();
    expect(optionalFromMinorUnits(250)).toBe(2.5);
  });
});
