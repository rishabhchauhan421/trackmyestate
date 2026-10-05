import { z } from "zod";

import {
  checkbox,
  date,
  email,
  enumValue,
  number,
  optionalDate,
  optionalEnumValue,
  optionalNumber,
  optionalText,
  parseFormData,
  text,
} from "./form";

function form(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

const Color = { RED: "RED", BLUE: "BLUE" } as const;

describe("parseFormData", () => {
  it("throws the first invalid field's message", () => {
    const schema = z.object({ a: text("Enter a"), b: text("Enter b") });
    expect(() => parseFormData(schema, form({}))).toThrow("Enter a");
  });

  it("drops fields the schema doesn't declare", () => {
    const schema = z.object({ a: text("Enter a") });
    expect(parseFormData(schema, form({ a: "x", extra: "y" }))).toEqual({
      a: "x",
    });
  });

  it("rejects a file where text is expected", () => {
    const schema = z.object({ a: text("Enter a") });
    const formData = new FormData();
    formData.set("a", new Blob(["x"]), "a.txt");
    expect(() => parseFormData(schema, formData)).toThrow("Enter a");
  });
});

describe("text / optionalText", () => {
  const schema = z.object({ name: text("Enter a name"), note: optionalText() });

  it("trims values and turns a blank optional into null", () => {
    expect(
      parseFormData(schema, form({ name: "  Home ", note: "  " })),
    ).toEqual({ name: "Home", note: null });
  });

  it("rejects a whitespace-only required value", () => {
    expect(() => parseFormData(schema, form({ name: "   " }))).toThrow(
      "Enter a name",
    );
  });
});

describe("number / optionalNumber", () => {
  const schema = z.object({
    amount: number("Enter a valid amount", { positive: true }),
    day: optionalNumber("Enter a valid day", { int: true, min: 1, max: 31 }),
  });

  it("parses numbers and turns a blank optional into null", () => {
    expect(parseFormData(schema, form({ amount: "12.5", day: "" }))).toEqual({
      amount: 12.5,
      day: null,
    });
  });

  it.each(["", "abc", "Infinity", "0", "-3"])("rejects amount %p", (amount) => {
    expect(() => parseFormData(schema, form({ amount }))).toThrow(
      "Enter a valid amount",
    );
  });

  it.each(["0", "32", "1.5"])("rejects day %p", (day) => {
    expect(() => parseFormData(schema, form({ amount: "1", day }))).toThrow(
      "Enter a valid day",
    );
  });

  it("uses the separate blank message when given", () => {
    const withBlank = z.object({ n: number("Invalid", {}, "Required") });
    expect(() => parseFormData(withBlank, form({}))).toThrow("Required");
    expect(() => parseFormData(withBlank, form({ n: "x" }))).toThrow("Invalid");
  });
});

describe("date / optionalDate", () => {
  const schema = z.object({
    start: date("Enter a valid start date", "Enter the start date"),
    end: optionalDate("Enter a valid end date"),
  });

  it("parses dates and turns a blank optional into null", () => {
    expect(
      parseFormData(schema, form({ start: "2026-01-15", end: "" })),
    ).toEqual({ start: new Date("2026-01-15"), end: null });
  });

  it("distinguishes a missing date from an invalid one", () => {
    expect(() => parseFormData(schema, form({}))).toThrow(
      "Enter the start date",
    );
    expect(() => parseFormData(schema, form({ start: "nope" }))).toThrow(
      "Enter a valid start date",
    );
    expect(() =>
      parseFormData(schema, form({ start: "2026-01-15", end: "nope" })),
    ).toThrow("Enter a valid end date");
  });
});

describe("enumValue / optionalEnumValue", () => {
  const schema = z.object({
    color: enumValue(Color, "Choose a color"),
    accent: optionalEnumValue(Color, "Choose a valid accent"),
  });

  it("accepts enum members and turns a blank optional into null", () => {
    expect(parseFormData(schema, form({ color: "RED", accent: "" }))).toEqual({
      color: "RED",
      accent: null,
    });
  });

  it("rejects values outside the enum", () => {
    expect(() => parseFormData(schema, form({ color: "GREEN" }))).toThrow(
      "Choose a color",
    );
    expect(() =>
      parseFormData(schema, form({ color: "RED", accent: "GREEN" })),
    ).toThrow("Choose a valid accent");
  });
});

describe("email", () => {
  const schema = z.object({ email: email("Enter a valid email") });

  it("accepts a well-formed address", () => {
    expect(parseFormData(schema, form({ email: " a@b.co " }))).toEqual({
      email: "a@b.co",
    });
  });

  it.each(["", "a@", "not@@email"])("rejects %p", (value) => {
    expect(() => parseFormData(schema, form({ email: value }))).toThrow(
      "Enter a valid email",
    );
  });
});

describe("checkbox", () => {
  const schema = z.object({ on: checkbox(), off: checkbox() });

  it("is true only when ticked", () => {
    expect(parseFormData(schema, form({ on: "on" }))).toEqual({
      on: true,
      off: false,
    });
  });
});
