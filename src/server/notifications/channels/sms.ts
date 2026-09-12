/**
 * SMS channel — phase 2 placeholder, not yet implemented. See
 * `whatsapp.ts` for the same pattern; every `SMS` job is marked `SKIPPED`
 * until this is filled in.
 *
 * Intended provider: any transactional SMS API keyed by sender id (Twilio,
 * MSG91, ...). Config already plumbed through `~/env`: `SMS_API_KEY`,
 * `SMS_SENDER_ID`.
 */
import "server-only";

import type { ChannelSender } from "../types";
import { NotImplementedChannelError } from "../types";

export const sendSms: ChannelSender = (_job) => {
  throw new NotImplementedChannelError("SMS");
};
