/**
 * zod field builders for parsing `FormData` submitted to Server Actions.
 *
 * Every builder takes the user-facing error message to show when the field
 * is invalid (and optionally a separate one for when it's left blank), so
 * each action's schema reads as a list of fields + messages. Blank inputs
 * (`""` or whitespace) are treated the same as a missing field: required
 * fields reject them, optional fields turn them into `null` — the value
 * Prisma expects for "not set".
 */
import { z } from "zod";

/** Trims strings and turns blank strings / `null` into `undefined`. */
function blankToUndefined(value: unknown) {
  if (typeof value !== "string") return value ?? undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function toNumber(value: unknown) {
  const v = blankToUndefined(value);
  return typeof v === "string" ? Number(v) : v;
}

function toDate(value: unknown) {
  const v = blankToUndefined(value);
  return typeof v === "string" ? new Date(v) : v;
}

/**
 * A schema-level `error` reporting `message` for every issue the schema
 * itself raises (type mismatch, NaN, Invalid Date, bad enum value, ...), or
 * `requiredMessage` when the field was missing altogether. In zod 4 this
 * doesn't reach chained checks like `.int()`, so those get `message` passed
 * explicitly — see `numberSchema`.
 */
function messages(message: string, requiredMessage = message) {
  return {
    error: (issue: { input?: unknown }) =>
      issue.input === undefined ? requiredMessage : message,
  };
}

type EnumLike = Readonly<Record<string, string>>;

/** Range checks for `number`/`optionalNumber`; each reports the field's message. */
type NumberRules = {
  int?: boolean;
  /** Greater than 0. */
  positive?: boolean;
  min?: number;
  max?: number;
};

function numberSchema(
  message: string,
  requiredMessage: string,
  { int, positive, min, max }: NumberRules,
) {
  // `z.number()` already rejects NaN and ±Infinity.
  let schema = z.number(messages(message, requiredMessage));
  if (int) schema = schema.int(message);
  if (positive) schema = schema.positive(message);
  if (min !== undefined) schema = schema.min(min, message);
  if (max !== undefined) schema = schema.max(max, message);
  return schema;
}

/** A required, trimmed, non-blank string. */
export function text(message: string) {
  return z.preprocess(blankToUndefined, z.string(messages(message)));
}

/** An optional trimmed string; blank becomes `null`. */
export function optionalText() {
  return z
    .preprocess(blankToUndefined, z.string().optional())
    .transform((value) => value ?? null);
}

/** A required email address. */
export function email(message: string) {
  return z.preprocess(blankToUndefined, z.email(messages(message)));
}

/**
 * A required number, e.g. `number("Enter a valid day", { int: true, min: 1,
 * max: 31 })`. `requiredMessage` replaces `message` when it's left blank.
 */
export function number(
  message: string,
  rules: NumberRules = {},
  requiredMessage = message,
) {
  return z.preprocess(toNumber, numberSchema(message, requiredMessage, rules));
}

/** An optional number; blank becomes `null`. See `number`. */
export function optionalNumber(message: string, rules: NumberRules = {}) {
  return z
    .preprocess(toNumber, numberSchema(message, message, rules).optional())
    .transform((value) => value ?? null);
}

/** A required, valid date (from an `<input type="date">` value). */
export function date(message: string, requiredMessage = message) {
  return z.preprocess(toDate, z.date(messages(message, requiredMessage)));
}

/** An optional, valid date; blank becomes `null`. */
export function optionalDate(message: string) {
  return z
    .preprocess(toDate, z.date(messages(message)).optional())
    .transform((value) => value ?? null);
}

/** A required value of a Prisma enum (e.g. `PropertyType`). */
export function enumValue<T extends EnumLike>(values: T, message: string) {
  return z.preprocess(blankToUndefined, z.enum(values, messages(message)));
}

/** An optional value of a Prisma enum; blank becomes `null`. */
export function optionalEnumValue<T extends EnumLike>(
  values: T,
  message: string,
) {
  return z
    .preprocess(blankToUndefined, z.enum(values, messages(message)).optional())
    .transform((value) => value ?? null);
}

/** An HTML checkbox: `true` when ticked (submitted as `"on"`). */
export function checkbox() {
  return z.preprocess((value) => value === "on", z.boolean());
}

/**
 * Parses `formData` against `schema`, throwing an `Error` with the first
 * invalid field's message — the same contract the actions had before
 * validation moved to zod, so callers and error UI don't change.
 */
export function parseFormData<T extends z.ZodType>(
  schema: T,
  formData: FormData,
): z.output<T> {
  const result = schema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Invalid form input");
  }
  return result.data;
}
