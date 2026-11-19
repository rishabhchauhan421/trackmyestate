import "server-only";

import { env } from "~/env";
import { signPayload, verifyPayload } from "~/server/signed-link";

/**
 * The signed "Mark paid" link in the owner's own reminder emails. It opens
 * `/reminders/paid`, where one click settles the bill without signing in:
 * the signature (of the bill's id) is the authorisation, so the link only
 * ever goes to the bill's owner, never to guests or utility recipients.
 * It stops doing anything once the bill is closed.
 */

const payload = (billId: string) => `bill-paid:${billId}`;

export function signBillPaid(billId: string) {
  return signPayload(payload(billId));
}

export function verifyBillPaid(billId: string, signature: string) {
  return verifyPayload(payload(billId), signature);
}

export function billPaidUrl(billId: string) {
  const params = new URLSearchParams({
    bill: billId,
    sig: signBillPaid(billId),
  });
  return `${env.NEXT_PUBLIC_SITE_URL}/reminders/paid?${params.toString()}`;
}
