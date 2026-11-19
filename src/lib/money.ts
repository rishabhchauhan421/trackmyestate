/**
 * Money is stored in minor units — paise for INR, cents for USD — as whole
 * numbers, so sums and EMI splits never pick up floating-point drift
 * (0.1 + 0.2 !== 0.3). Every currency the app supports has 100 minor units.
 *
 * The database column stays a `Float` (a 64-bit double) on purpose: Prisma's
 * `Int` is 32-bit on MongoDB, which would cap amounts at about ₹2.1 crore,
 * while a double holds every whole number up to 2^53 exactly (about ₹90
 * lakh crore in paise).
 *
 * Convert at the edges only: forms parse rupees into minor units
 * (`money`/`optionalMoney` in `~/lib/form`), and formatters and form
 * `defaultValue`s turn minor units back into rupees.
 */

export const MINOR_UNITS_PER_MAJOR = 100;

/** Rupees (or dollars…) to whole minor units, rounded half away from zero. */
export function toMinorUnits(major: number): number {
  // `toFixed` first, so 1.005 (stored as 1.00499999…) rounds to 101 paise.
  const scaled = Number((major * MINOR_UNITS_PER_MAJOR).toFixed(6));
  return Math.sign(scaled) * Math.round(Math.abs(scaled));
}

/** Minor units back to rupees, e.g. for a form field's default value. */
export function fromMinorUnits(minor: number): number {
  return minor / MINOR_UNITS_PER_MAJOR;
}

/** `fromMinorUnits` for an optional amount; `null`/`undefined` pass through. */
export function optionalFromMinorUnits(
  minor: number | null | undefined,
): number | undefined {
  return minor == null ? undefined : fromMinorUnits(minor);
}
