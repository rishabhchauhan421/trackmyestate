import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { env } from "~/env";
import { db } from "~/server/db";

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
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: env.BETTER_AUTH_GOOGLE_CLIENT_ID,
      clientSecret: env.BETTER_AUTH_GOOGLE_CLIENT_SECRET,
    },
  },
  // Calls to `auth.api.*` from Server Components/Actions (see app/page.tsx)
  // only set real response cookies when this plugin forwards them via
  // `next/headers`. Without it, e.g. the OAuth state cookie never reaches
  // the browser even though the DB-side verification record is written,
  // causing "State mismatch: State not persisted correctly" on callback.
  // Must stay the last plugin.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
