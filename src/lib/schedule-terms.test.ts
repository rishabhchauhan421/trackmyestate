import { occurrencesBetween } from "./schedule";
import {
  expectedReturnAmount,
  oneOffTerms,
  policyEndDate,
  premiumTerms,
} from "./schedule-terms";

const days = (
  terms: ReturnType<typeof oneOffTerms>,
  from: string,
  to: string,
) =>
  occurrencesBetween(
    {
      ...terms,
      dueMonth: terms.dueMonth ?? null,
      tenureMonths: terms.tenureMonths ?? null,
      createdAt: new Date("2026-01-01"),
    },
    from,
    to,
  ).map((o) => o.day);

describe("oneOffTerms", () => {
  it("falls due exactly once", () => {
    const terms = oneOffTerms(new Date("2027-03-15"), 500);
    expect(days(terms, "2026-01-01", "2030-12-31")).toEqual(["2027-03-15"]);
  });
});

describe("premiumTerms", () => {
  it("repeats quarterly from the next premium date", () => {
    const terms = premiumTerms("QUARTERLY", new Date("2026-11-10"), 900);
    expect(days(terms, "2026-11-01", "2027-06-30")).toEqual([
      "2026-11-10",
      "2027-02-10",
      "2027-05-10",
    ]);
  });

  it("stops when the policy ends", () => {
    const terms = premiumTerms(
      "YEARLY",
      new Date("2026-11-10"),
      900,
      new Date("2028-11-09"),
    );
    expect(days(terms, "2026-01-01", "2032-12-31")).toEqual([
      "2026-11-10",
      "2027-11-10",
    ]);
  });

  it("is a single premium for SINGLE", () => {
    const terms = premiumTerms("SINGLE", new Date("2026-11-10"), 900);
    expect(days(terms, "2026-01-01", "2032-12-31")).toEqual(["2026-11-10"]);
  });
});

describe("policyEndDate", () => {
  it("is the day before the term's anniversary", () => {
    expect(policyEndDate(new Date("2020-11-10"), 10)).toEqual(
      new Date("2030-11-09"),
    );
    expect(policyEndDate(new Date("2020-11-10"), null)).toBeNull();
  });
});

describe("expectedReturnAmount", () => {
  it("prefers the current estimate, then the target return, then capital", () => {
    const base = {
      capitalDeployed: 100_000,
      targetRoiPercent: null,
      currentEstimatedValue: null,
    };
    expect(
      expectedReturnAmount({
        ...base,
        currentEstimatedValue: 130_000,
        targetRoiPercent: 8,
      }),
    ).toBe(130_000);
    expect(expectedReturnAmount({ ...base, targetRoiPercent: 7.5 })).toBe(
      107_500,
    );
    expect(expectedReturnAmount(base)).toBe(100_000);
  });
});
