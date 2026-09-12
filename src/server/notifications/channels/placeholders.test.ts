/**
 * The WhatsApp/SMS/push channels aren't built yet — each must throw
 * `NotImplementedChannelError` so the engine marks their jobs `SKIPPED`
 * instead of silently doing nothing or crashing the batch.
 */
import { sendPush } from "./push";
import { sendSms } from "./sms";
import { sendWhatsApp } from "./whatsapp";
import { NotImplementedChannelError } from "../types";
import type { NotificationJobWithMetadata } from "../types";

const JOB = {
  id: "job-1",
  recipient: "+919999999999",
} as unknown as NotificationJobWithMetadata;

describe("unimplemented channels", () => {
  it("sendWhatsApp throws NotImplementedChannelError", () => {
    expect(() => sendWhatsApp(JOB)).toThrow(NotImplementedChannelError);
    expect(() => sendWhatsApp(JOB)).toThrow(/WHATSAPP/);
  });

  it("sendSms throws NotImplementedChannelError", () => {
    expect(() => sendSms(JOB)).toThrow(NotImplementedChannelError);
    expect(() => sendSms(JOB)).toThrow(/SMS/);
  });

  it("sendPush throws NotImplementedChannelError", () => {
    expect(() => sendPush(JOB)).toThrow(NotImplementedChannelError);
    expect(() => sendPush(JOB)).toThrow(/PUSH/);
  });
});
