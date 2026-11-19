/**
 * Maps every `ReminderChannel` to its sender. Typed as `Record<ReminderChannel, ...>`
 * (same trick as `~/lib/labels`) so adding a channel to the schema without
 * wiring a sender here is a compile error, not a silent runtime gap.
 */
import type { ReminderChannel } from "../../../generated/prisma";
import { sendEmail, sendEmailDigest } from "./channels/email";
import { sendPush } from "./channels/push";
import { sendSms } from "./channels/sms";
import { sendWhatsApp } from "./channels/whatsapp";
import type { ChannelDigestSender, ChannelSender } from "./types";

export const CHANNEL_SENDERS: Record<ReminderChannel, ChannelSender> = {
  EMAIL: sendEmail,
  WHATSAPP: sendWhatsApp,
  SMS: sendSms,
  PUSH: sendPush,
};

/**
 * Channels that can combine one recipient's due jobs into a single message
 * (see `dispatchNotificationJobs`). The rest send each job on its own.
 */
export const CHANNEL_DIGEST_SENDERS: Partial<
  Record<ReminderChannel, ChannelDigestSender>
> = {
  EMAIL: sendEmailDigest,
};
