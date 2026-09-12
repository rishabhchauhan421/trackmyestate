/**
 * Maps every `ReminderChannel` to its sender. Typed as `Record<ReminderChannel, ...>`
 * (same trick as `~/lib/labels`) so adding a channel to the schema without
 * wiring a sender here is a compile error, not a silent runtime gap.
 */
import type { ReminderChannel } from "../../../generated/prisma";
import { sendEmail } from "./channels/email";
import { sendPush } from "./channels/push";
import { sendSms } from "./channels/sms";
import { sendWhatsApp } from "./channels/whatsapp";
import type { ChannelSender } from "./types";

export const CHANNEL_SENDERS: Record<ReminderChannel, ChannelSender> = {
  EMAIL: sendEmail,
  WHATSAPP: sendWhatsApp,
  SMS: sendSms,
  PUSH: sendPush,
};
