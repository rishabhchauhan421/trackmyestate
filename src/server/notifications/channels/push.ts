/**
 * Push channel — not yet implemented. `ReminderChannel.PUSH` exists in the
 * schema (see the "Push notifications" toggle on the settings page) but no
 * phase is scoped for it yet; kept here only so the channel registry stays
 * exhaustive over `ReminderChannel`.
 */
import "server-only";

import type { ChannelSender } from "../types";
import { NotImplementedChannelError } from "../types";

export const sendPush: ChannelSender = (_job) => {
  throw new NotImplementedChannelError("PUSH");
};
