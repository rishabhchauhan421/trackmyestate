/**
 * better-auth server instance: the single source of truth for how sign-in,
 * sessions and OAuth work in this app. Server Components/Actions read
 * `auth.api.getSession`/`auth.api.signOut` etc. (see `./server.ts`); the
 * `[...all]` route handler forwards raw HTTP auth requests to `auth.handler`.
 */
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { after } from "next/server";

import { env } from "~/env";
import { db } from "~/server/db";
import { sendPasswordResetEmail, sendVerificationEmail } from "./emails";

/** Password length limits, enforced by better-auth and our own forms. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * How long a signed copy of the session is trusted from the cookie before
 * the database is asked again. Signing out elsewhere, a ban or a password
 * reset can take this long to reach another device; admin checks skip the
 * copy (`getFreshSession`).
 */
export const SESSION_COOKIE_CACHE_SECONDS = 5 * 60;

/** How long an emailed "confirm your email" link stays valid. */
export const VERIFICATION_LINK_TTL_SECONDS = 24 * 60 * 60;

/** better-auth instance, configured for MongoDB + Google OAuth + email/password. */
export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "mongodb",
  }),
  advanced: {
    database: {
      // Let Prisma/MongoDB generate the `_id` (a real ObjectId) instead of
      // better-auth's default random string id, which isn't valid MongoDB
      // ObjectId hex and fails against the `@db.ObjectId` columns.
      generateId: false,
    },
  },
  session: {
    // Most requests read the session from a signed cookie instead of two
    // database lookups. Server Components can't write cookies, so
    // `src/proxy.ts` renews the copy when it runs out.
    cookieCache: {
      enabled: true,
      maxAge: SESSION_COOKIE_CACHE_SECONDS,
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    // `url` is better-auth's own `/api/auth/reset-password/:token` endpoint,
    // which checks the token and redirects to our `/reset-password` page
    // (the `redirectTo` passed in `requestPasswordReset`). Sent via
    // `after()` so the response time doesn't reveal whether the email has
    // an account.
    sendResetPassword: async ({ user, url }) => {
      after(() =>
        sendPasswordResetEmail({ to: user.email, name: user.name, url }),
      );
    },
    // A reset usually means the old password may be compromised, so sign
    // out every existing session.
    revokeSessionsOnPasswordReset: true,
    // No session until the address is confirmed. Signing up with an email
    // that already has an account answers exactly like a new sign-up, so the
    // form can't be used to find out who's registered.
    requireEmailVerification: true,
  },
  emailVerification: {
    // Sent via `after()` for the same reason as the reset email.
    sendVerificationEmail: async ({ user, url }) => {
      after(() =>
        sendVerificationEmail({ to: user.email, name: user.name, url }),
      );
    },
    sendOnSignUp: true,
    // An unverified account that tries to sign in gets a fresh link (the
    // sign-in action limits how often).
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: VERIFICATION_LINK_TTL_SECONDS,
  },
  account: {
    accountLinking: {
      // Google sign-in only joins an existing account whose email has been
      // confirmed (better-auth's default, kept explicit): otherwise someone
      // could sign up with another person's address, wait for them to use
      // Google, and share their account.
      requireLocalEmailVerified: true,
    },
  },
  rateLimit: {
    // Limits for the `/api/auth/*` HTTP endpoints, stored in MongoDB so
    // they hold across serverless instances. Server Actions call
    // `auth.api.*` directly and are limited in `~/server/rate-limit`.
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 3600, max: 5 },
      "/request-password-reset": { window: 3600, max: 5 },
      "/send-verification-email": { window: 3600, max: 5 },
    },
  },
  socialProviders: {
    google: {
      clientId: env.BETTER_AUTH_GOOGLE_CLIENT_ID,
      clientSecret: env.BETTER_AUTH_GOOGLE_CLIENT_SECRET,
    },
  },
  plugins: [
    // Adds `role`/`banned`/`banReason`/`banExpires` to the session user and
    // the `/admin/*` server endpoints (set-role, ban, impersonate, ...).
    // `role: "admin"` is what gates `(app)/admin` — see
    // `src/server/better-auth/server.ts`'s `requireAdminSession`. Promote
    // the first admin with `pnpm tsx scripts/set-admin-role.ts <email>`.
    admin(),
    // Calls to `auth.api.*` from Server Components/Actions (see app/page.tsx)
    // only set real response cookies when this plugin forwards them via
    // `next/headers`. Without it, e.g. the OAuth state cookie never reaches
    // the browser even though the DB-side verification record is written,
    // causing "State mismatch: State not persisted correctly" on callback.
    // Must stay the last plugin.
    nextCookies(),
  ],
});

/** Inferred session/user shape, derived from the actual `auth` config above. */
export type Session = typeof auth.$Infer.Session;
