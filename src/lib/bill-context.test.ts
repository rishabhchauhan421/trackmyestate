import { billAsset, billTitle } from "./bill-context";

describe("billTitle", () => {
  it("prefers the bill's own description", () => {
    expect(
      billTitle({ category: "CUSTOM", description: "Society maintenance" }),
    ).toBe("Society maintenance");
  });

  it("names a utility bill by provider and type", () => {
    expect(
      billTitle({
        category: "UTILITY_BILL",
        billSchedule: { billType: "ELECTRICITY", provider: "Tata Power" },
      }),
    ).toBe("Tata Power · Electricity");
    expect(
      billTitle({
        category: "UTILITY_BILL",
        billSchedule: { billType: "ELECTRICITY", provider: null },
      }),
    ).toBe("Electricity");
  });

  it("names other bills by category and the other party", () => {
    expect(
      billTitle({ category: "EMI", loan: { id: "l1", lender: "HDFC Bank" } }),
    ).toBe("EMI · HDFC Bank");
    expect(
      billTitle({
        category: "RENT",
        lease: { id: "t1", tenantName: "Priya Shah", propertyId: "p1" },
      }),
    ).toBe("Rent · Priya Shah");
    expect(billTitle({ category: "PAYOUT" })).toBe("Payout");
  });
});

describe("billAsset", () => {
  it("links rent to the property's leases", () => {
    expect(
      billAsset({
        category: "RENT",
        property: { id: "p1", name: "Flat 4B" },
        lease: { id: "t1", tenantName: "Priya Shah", propertyId: "p1" },
      }),
    ).toEqual({ label: "Priya Shah", href: "/properties/p1/leases" });
  });

  it("links a utility bill to the property's utilities", () => {
    expect(
      billAsset({
        category: "UTILITY_BILL",
        property: { id: "p1", name: "Flat 4B" },
      }),
    ).toEqual({ label: "Flat 4B", href: "/properties/p1/utilities" });
  });

  it("links loans, policies and investments to their pages", () => {
    expect(
      billAsset({ category: "EMI", loan: { id: "l1", lender: "HDFC" } }),
    ).toEqual({ label: "HDFC", href: "/loans/l1/edit" });
    expect(
      billAsset({ category: "PREMIUM", policy: { id: "x", insurer: "LIC" } }),
    ).toEqual({ label: "LIC", href: "/insurance/x/edit" });
    expect(
      billAsset({
        category: "INVESTMENT_RETURN",
        investment: { id: "i", name: "FD" },
      }),
    ).toEqual({ label: "FD", href: "/investments/i/edit" });
  });

  it("is null for a bill that belongs to nothing", () => {
    expect(billAsset({ category: "CUSTOM" })).toBeNull();
  });
});
