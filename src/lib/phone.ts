/**
 * Indian mobile numbers, the only kind the app accepts for now: stored in
 * E.164 ("+919876543210"), shown grouped ("+91 98765 43210").
 */

/**
 * "+919876543210" from what someone typed — with or without spaces,
 * dashes, "+91", "91" or a leading 0 — or null when it isn't a valid
 * 10-digit Indian mobile number (which starts with 6-9).
 */
export function normalizeIndianMobile(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("91"))
    digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0"))
    digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

/** "+91 98765 43210" for a stored "+919876543210" (others unchanged). */
export function formatPhone(phone: string) {
  const match = /^\+91(\d{5})(\d{5})$/.exec(phone);
  return match ? `+91 ${match[1]} ${match[2]}` : phone;
}

/** The 10 digits after +91, for prefilling a "+91 [ … ]" input. */
export function localMobileDigits(phone: string | null | undefined) {
  return phone?.startsWith("+91") ? phone.slice(3) : (phone ?? "");
}
