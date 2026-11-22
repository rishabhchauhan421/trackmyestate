import {
  addMonthsClamped,
  freeholdCheckRound,
  issueAlertsFor,
  nextKeyDate,
  planInstalments,
  type IssueForAlerts,
} from "./issues";

describe("addMonthsClamped", () => {
  it("keeps the day of the month", () => {
    expect(addMonthsClamped("2026-11-15", 3)).toBe("2027-02-15");
  });

  it("uses the month's last day when it's shorter", () => {
    expect(addMonthsClamped("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonthsClamped("2028-01-31", 1)).toBe("2028-02-29");
  });
});

describe("planInstalments", () => {
  it("splits the total evenly, spaced by the interval", () => {
    expect(
      planInstalments({
        total: 1_200_000,
        count: 4,
        firstDueDay: "2026-12-10",
        interval: "QUARTERLY",
      }),
    ).toEqual([
      { number: 1, dueDay: "2026-12-10", amount: 300_000 },
      { number: 2, dueDay: "2027-03-10", amount: 300_000 },
      { number: 3, dueDay: "2027-06-10", amount: 300_000 },
      { number: 4, dueDay: "2027-09-10", amount: 300_000 },
    ]);
  });

  it("puts what doesn't divide evenly on the last instalment", () => {
    const plan = planInstalments({
      total: 1_000_00,
      count: 3,
      firstDueDay: "2026-12-31",
      interval: "MONTHLY",
    });

    expect(plan.map((instalment) => instalment.amount)).toEqual([
      33_333, 33_333, 33_334,
    ]);
    expect(plan.reduce((sum, instalment) => sum + instalment.amount, 0)).toBe(
      1_000_00,
    );
    // 31 Dec, then the last day of each shorter month.
    expect(plan.map((instalment) => instalment.dueDay)).toEqual([
      "2026-12-31",
      "2027-01-31",
      "2027-02-28",
    ]);
  });
});

describe("issueAlertsFor", () => {
  const hearing = (day: string, done = false) => ({
    id: "kd-1",
    label: "Next hearing",
    day,
    done,
  });
  const issue = (overrides: Partial<IssueForAlerts> = {}): IssueForAlerts => ({
    keyDates: [],
    lastActivityDay: "2026-11-20",
    hasOpenDues: false,
    ...overrides,
  });
  const kinds = (alerts: ReturnType<typeof issueAlertsFor>) =>
    alerts.map((alert) => `${alert.kind}:${alert.key}`);

  it.each([
    ["2026-11-23", "KEY_DATE:kd-1:-7"],
    ["2026-11-29", "KEY_DATE:kd-1:-1"],
    ["2026-11-30", "KEY_DATE:kd-1:0"],
  ])("alerts for a key date on %s", (today, expected) => {
    expect(
      kinds(
        issueAlertsFor(issue({ keyDates: [hearing("2026-11-30")] }), today),
      ),
    ).toEqual([expected]);
  });

  it("stays quiet on days with no slot", () => {
    expect(
      issueAlertsFor(
        issue({ keyDates: [hearing("2026-11-30")] }),
        "2026-11-26",
      ),
    ).toEqual([]);
  });

  it("catches up a slot the day after it was missed, under the same key", () => {
    // 6 days before: the 7-day alert, in case yesterday's run never queued it.
    expect(
      kinds(
        issueAlertsFor(
          issue({ keyDates: [hearing("2026-11-30")] }),
          "2026-11-24",
        ),
      ),
    ).toEqual(["KEY_DATE:kd-1:-7"]);
  });

  it("asks to finalise the day after the date passes, and a week later", () => {
    const withHearing = issue({ keyDates: [hearing("2026-11-30")] });

    expect(kinds(issueAlertsFor(withHearing, "2026-12-01"))).toEqual([
      "FINALISE:kd-1:1",
    ]);
    expect(kinds(issueAlertsFor(withHearing, "2026-12-08"))).toEqual([
      "FINALISE:kd-1:8",
    ]);
    expect(issueAlertsFor(withHearing, "2026-12-05")).toEqual([]);
  });

  it("doesn't ask to finalise once the date is ticked done", () => {
    expect(
      issueAlertsFor(
        issue({ keyDates: [hearing("2026-11-30", true)] }),
        "2026-12-01",
      ),
    ).toEqual([]);
  });

  it("doesn't ask to finalise once a later date is set", () => {
    const alerts = issueAlertsFor(
      issue({
        keyDates: [
          hearing("2026-11-30"),
          { id: "kd-2", label: "Next hearing", day: "2027-01-15", done: false },
        ],
      }),
      "2026-12-01",
    );

    expect(alerts).toEqual([]);
  });

  it("flags an issue nobody has touched for 90 days, and every 90 after", () => {
    const quiet = issue({ lastActivityDay: "2026-08-01" });

    expect(kinds(issueAlertsFor(quiet, "2026-10-30"))).toEqual([
      "QUIET:quiet:2026-10-30",
    ]);
    // The day after, under the same key (a catch-up, not a second email).
    expect(kinds(issueAlertsFor(quiet, "2026-10-31"))).toEqual([
      "QUIET:quiet:2026-10-30",
    ]);
    expect(issueAlertsFor(quiet, "2026-11-15")).toEqual([]);
    expect(kinds(issueAlertsFor(quiet, "2027-01-28"))).toEqual([
      "QUIET:quiet:2027-01-28",
    ]);
  });

  it("isn't quiet while a date or an unpaid due is still ahead", () => {
    expect(
      issueAlertsFor(
        issue({ lastActivityDay: "2026-08-01", hasOpenDues: true }),
        "2026-10-30",
      ),
    ).toEqual([]);
    expect(
      issueAlertsFor(
        issue({
          lastActivityDay: "2026-08-01",
          keyDates: [hearing("2027-03-01")],
        }),
        "2026-10-30",
      ),
    ).toEqual([]);
  });
});

describe("freeholdCheckRound", () => {
  it("falls every six months from the day it was switched on", () => {
    expect(freeholdCheckRound("2026-11-22", "2027-05-22")).toBe(1);
    expect(freeholdCheckRound("2026-11-22", "2027-11-22")).toBe(2);
  });

  it("catches up the day after", () => {
    expect(freeholdCheckRound("2026-11-22", "2027-05-23")).toBe(1);
  });

  it("is null on any other day, including the day it was switched on", () => {
    expect(freeholdCheckRound("2026-11-22", "2026-11-22")).toBeNull();
    expect(freeholdCheckRound("2026-11-22", "2027-03-01")).toBeNull();
  });
});

describe("nextKeyDate", () => {
  const day = (value: string) => new Date(`${value}T00:00:00Z`);

  it("is the soonest date not yet done, today included", () => {
    const next = nextKeyDate(
      [
        { date: day("2027-02-01"), done: false },
        { date: day("2026-11-22"), done: false },
        { date: day("2026-11-01"), done: false },
        { date: day("2026-11-25"), done: true },
      ],
      day("2026-11-22"),
    );

    expect(next?.date).toEqual(day("2026-11-22"));
  });

  it("is undefined when nothing is ahead", () => {
    expect(
      nextKeyDate(
        [{ date: day("2026-11-01"), done: false }],
        day("2026-11-22"),
      ),
    ).toBeUndefined();
  });
});
