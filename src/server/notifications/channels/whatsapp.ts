/**
 * WhatsApp channel — phase 2 placeholder, not yet implemented. Wired into
 * `ReminderChannel.WHATSAPP` via `~/server/notifications/registry` so the
 * engine can route to it today and just needs this file filled in later;
 * every `WHATSAPP` job is marked `SKIPPED` (not `FAILED`) until then — see
 * `NotImplementedChannelError` in `../types`.
 *
 * Intended provider: Meta's WhatsApp Cloud API (a template message per job,
 * since WhatsApp requires pre-approved templates for business-initiated
 * conversations). Config already plumbed through `~/env`:
 * `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`.
 */
import "server-only";

import type { ChannelSender } from "../types";
import { NotImplementedChannelError } from "../types";

export const sendWhatsApp: ChannelSender = (_job) => {
  throw new NotImplementedChannelError("WHATSAPP");
};
