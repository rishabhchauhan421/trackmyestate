import {
  REMINDER_CATEGORIES,
  REMINDER_OFFSET_PRESETS,
  formatReminderOffset,
  normalizeOffsets,
  sameOffsets,
} from "./reminders";

describe("formatReminderOffset", () => {
  it.each([
    [-30, "30 days before"],
    [-1, "1 day before"],
    [0, "On the day"],
    [1, "1 day after"],
    [7, "7 days after"],
  ])("formats %p as %p", (offset, label) => {
    expect(formatReminderOffset(offset)).toBe(label);
  });
});

describe("offset helpers", () => {
  it("sorts and de-duplicates", () => {
    expect(normalizeOffsets([0, -7, 0, 3])).toEqual([-7, 0, 3]);
  });

  it("compares as sets", () => {
    expect(sameOffsets([0, -3], [-3, 0, 0])).toBe(true);
    expect(sameOffsets([0], [-3, 0])).toBe(false);
  });
});

describe("REMINDER_CATEGORIES", () => {
  it("only uses offsets a user could pick in Settings", () => {
    for (const { defaultOffsets } of REMINDER_CATEGORIES) {
      for (const offset of defaultOffsets) {
        expect(REMINDER_OFFSET_PRESETS).toContain(offset);
      }
    }
  });
});
