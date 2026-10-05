import {
  firstDueDayAfter,
  nextBillFor,
  nextOccurrence,
  occurrencesBetween,
  scheduleAnchor,
  type ScheduleTiming,
} from "./schedule";

function schedule(overrides: Partial<ScheduleTiming> = {}): ScheduleTiming {
  return {
    recurrence: "MONTHLY",
    dueDay: 10,
    dueMonth: null,
    startDate: new Date("2026-01-10"),
    createdAt: new Date("2026-01-01T09:00:00Z"),
    tenureMonths: null,
    ...overrides,
  };
}

const days = (occurrences: { day: string }[]) => occurrences.map((o) => o.day);

describe("occurrencesBetween", () => {
  it("lists monthly due days in a range, inclusive", () => {
    expect(
      days(occurrencesBetween(schedule(), "2026-03-10", "2026-06-10")),
    ).toEqual(["2026-03-10", "2026-04-10", "2026-05-10", "2026-06-10"]);
  });

  it("never lists days before the schedule starts", () => {
    expect(
      days(occurrencesBetween(schedule(), "2025-11-01", "2026-02-15")),
    ).toEqual(["2026-01-10", "2026-02-10"]);
  });

  it("clamps a 31st to the end of shorter months", () => {
    const s = schedule({ dueDay: 31, startDate: new Date("2026-01-31") });
    expect(days(occurrencesBetween(s, "2026-01-01", "2026-05-31"))).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
    ]);
    // Leap year.
    expect(days(occurrencesBetween(s, "2028-02-01", "2028-02-29"))).toEqual([
      "2028-02-29",
    ]);
  });

  it.each([
    ["QUARTERLY", ["2026-01-10", "2026-04-10", "2026-07-10", "2026-10-10"]],
    ["HALF_YEARLY", ["2026-01-10", "2026-07-10"]],
    ["YEARLY", ["2026-01-10"]],
  ] as const)("steps %s schedules by their period", (recurrence, expected) => {
    expect(
      days(
        occurrencesBetween(
          schedule({ recurrence }),
          "2026-01-01",
          "2026-12-31",
        ),
      ),
    ).toEqual(expected);
  });

  it("crosses into the next year", () => {
    const s = schedule({
      recurrence: "QUARTERLY",
      startDate: new Date("2026-11-05"),
      dueDay: 5,
    });
    expect(days(occurrencesBetween(s, "2026-11-01", "2027-06-01"))).toEqual([
      "2026-11-05",
      "2027-02-05",
      "2027-05-05",
    ]);
  });

  it("steps weekly and every-2-weeks schedules by days from the start", () => {
    const weekly = schedule({
      recurrence: "WEEKLY",
      startDate: new Date("2026-10-01"),
    });
    expect(
      days(occurrencesBetween(weekly, "2026-10-01", "2026-10-22")),
    ).toEqual(["2026-10-01", "2026-10-08", "2026-10-15", "2026-10-22"]);
    const fortnightly = schedule({
      recurrence: "BI_WEEKLY",
      startDate: new Date("2026-10-01"),
    });
    expect(
      days(occurrencesBetween(fortnightly, "2026-10-02", "2026-11-01")),
    ).toEqual(["2026-10-15", "2026-10-29"]);
  });

  it("stops after an EMI's tenure, numbering the instalments", () => {
    const emi = schedule({
      dueDay: 5,
      startDate: new Date("2026-01-05"),
      tenureMonths: 3,
    });
    expect(occurrencesBetween(emi, "2026-01-01", "2026-12-31")).toEqual([
      { day: "2026-01-05", installment: 1 },
      { day: "2026-02-05", installment: 2 },
      { day: "2026-03-05", installment: 3 },
    ]);
  });

  it("numbers instalments from the start even for a later window", () => {
    const emi = schedule({
      dueDay: 5,
      startDate: new Date("2020-01-05"),
      tenureMonths: 240,
    });
    expect(occurrencesBetween(emi, "2026-10-01", "2026-10-31")).toEqual([
      { day: "2026-10-05", installment: 82 },
    ]);
  });

  it("finds occurrences far from the start without missing any", () => {
    const s = schedule({ startDate: new Date("2001-03-10") });
    expect(days(occurrencesBetween(s, "2026-09-01", "2026-11-30"))).toEqual([
      "2026-09-10",
      "2026-10-10",
      "2026-11-10",
    ]);
  });

  it("returns nothing for an empty range", () => {
    expect(occurrencesBetween(schedule(), "2026-05-11", "2026-05-01")).toEqual(
      [],
    );
  });
});

describe("scheduleAnchor for schedules without a start date", () => {
  it("uses the first due day on or after creation", () => {
    expect(
      scheduleAnchor(
        schedule({
          startDate: null,
          dueDay: 5,
          createdAt: new Date("2026-10-07T10:00:00Z"),
        }),
      ),
    ).toBe("2026-11-05");
    expect(
      scheduleAnchor(
        schedule({
          startDate: null,
          dueDay: 20,
          createdAt: new Date("2026-10-07T10:00:00Z"),
        }),
      ),
    ).toBe("2026-10-20");
  });

  it("uses dueMonth for a yearly schedule", () => {
    const yearly = schedule({
      recurrence: "YEARLY",
      startDate: null,
      dueDay: 15,
      dueMonth: 3,
      createdAt: new Date("2026-10-07T10:00:00Z"),
    });
    expect(scheduleAnchor(yearly)).toBe("2027-03-15");
    expect(
      days(occurrencesBetween(yearly, "2027-01-01", "2028-12-31")),
    ).toEqual(["2027-03-15", "2028-03-15"]);
  });
});

describe("nextOccurrence", () => {
  it("is the due day itself when today is a due day", () => {
    expect(nextOccurrence(schedule(), "2026-10-10")).toEqual({
      day: "2026-10-10",
      installment: 10,
    });
  });

  it("is the following due day otherwise", () => {
    expect(nextOccurrence(schedule(), "2026-10-11")?.day).toBe("2026-11-10");
  });

  it("finds a yearly schedule's next date", () => {
    const yearly = schedule({
      recurrence: "YEARLY",
      startDate: new Date("2026-03-15"),
      dueDay: 15,
    });
    expect(nextOccurrence(yearly, "2026-10-07")?.day).toBe("2027-03-15");
  });

  it("is null once an EMI has finished", () => {
    const emi = schedule({
      startDate: new Date("2026-01-10"),
      tenureMonths: 3,
    });
    expect(nextOccurrence(emi, "2026-04-01")).toBeNull();
  });

  it("is the start date for a schedule that hasn't started", () => {
    expect(
      nextOccurrence(
        schedule({ startDate: new Date("2027-02-10") }),
        "2026-10-07",
      )?.day,
    ).toBe("2027-02-10");
  });
});

describe("firstDueDayAfter", () => {
  it.each([
    ["2026-10-01", 5, "2026-10-05"],
    ["2026-10-05", 5, "2026-11-05"],
    ["2026-10-20", 5, "2026-11-05"],
    ["2026-01-31", 31, "2026-02-28"],
    ["2026-12-15", 10, "2027-01-10"],
  ])("after %p, due on the %p → %p", (day, dueDay, expected) => {
    expect(firstDueDayAfter(day, dueDay)).toBe(expected);
  });
});

describe("nextBillFor", () => {
  const s = { ...schedule(), defaultAmount: 1500 };

  it("prefers the earliest unpaid bill, even an overdue one", () => {
    expect(
      nextBillFor(
        s,
        [
          { dueDate: new Date("2026-11-10"), amount: 1600 },
          { dueDate: new Date("2026-10-10"), amount: 1550 },
        ],
        "2026-10-20",
      ),
    ).toEqual({ dueDate: new Date("2026-10-10"), amount: 1550 });
  });

  it("falls back to the schedule's next due day before any bill exists", () => {
    expect(nextBillFor(s, [], "2026-10-11")).toEqual({
      dueDate: new Date("2026-11-10"),
      amount: 1500,
    });
  });

  it("is null for a finished schedule with nothing unpaid", () => {
    expect(nextBillFor({ ...s, tenureMonths: 2 }, [], "2026-06-01")).toBeNull();
  });
});
