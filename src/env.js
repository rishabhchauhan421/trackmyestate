import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    BETTER_AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    BETTER_AUTH_GITHUB_CLIENT_ID: z.string(),
    BETTER_AUTH_GITHUB_CLIENT_SECRET: z.string(),
    BETTER_AUTH_GOOGLE_CLIENT_ID: z.string(),
    BETTER_AUTH_GOOGLE_CLIENT_SECRET: z.string(),
    DATABASE_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    BETTER_AUTH_URL: z.string().url(),

    // Notification engine — email (phase 1, live).
    RESEND_API_KEY:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    NOTIFICATIONS_EMAIL_FROM: z
      .string()
      .email()
      .default("notifications@trackmyestate.app"),
    // Authenticates the cron trigger that drains due `NotificationJob`s
    // (see `src/app/api/cron/notifications/route.ts`).
    CRON_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),

    // Notification engine — WhatsApp (placeholder, not yet implemented; see
    // `src/server/notifications/channels/whatsapp.ts`). Left optional so the
    // schema documents the shape of phase-2 config without requiring it now.
    WHATSAPP_API_TOKEN: z.string().optional(),
    WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),

    // Notification engine — SMS (placeholder, not yet implemented; see
    // `src/server/notifications/channels/sms.ts`).
    SMS_API_KEY: z.string().optional(),
    SMS_SENDER_ID: z.string().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_SITE_URL: z.string().url().default("https://trackmyestate.app"),
    NEXT_PUBLIC_GTM_ID: z.string().optional(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_GTM_ID: process.env.GTM_ID,

    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,

    BETTER_AUTH_GITHUB_CLIENT_ID: process.env.BETTER_AUTH_GITHUB_CLIENT_ID,
    BETTER_AUTH_GITHUB_CLIENT_SECRET:
      process.env.BETTER_AUTH_GITHUB_CLIENT_SECRET,
    BETTER_AUTH_GOOGLE_CLIENT_ID: process.env.BETTER_AUTH_GOOGLE_CLIENT_ID,
    BETTER_AUTH_GOOGLE_CLIENT_SECRET:
      process.env.BETTER_AUTH_GOOGLE_CLIENT_SECRET,

    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,

    RESEND_API_KEY: process.env.RESEND_API_KEY,
    NOTIFICATIONS_EMAIL_FROM: process.env.NOTIFICATIONS_EMAIL_FROM,
    CRON_SECRET: process.env.CRON_SECRET,

    WHATSAPP_API_TOKEN: process.env.WHATSAPP_API_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,

    SMS_API_KEY: process.env.SMS_API_KEY,
    SMS_SENDER_ID: process.env.SMS_SENDER_ID,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
