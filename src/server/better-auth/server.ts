/**
 * Server Component-facing session reader. Every page under `(app)/` calls
 * this (directly or via a layout) to get the current user and redirect
 * unauthenticated visitors — see e.g. `src/app/(app)/layout.tsx`.
 */
import { auth } from ".";
import { headers } from "next/headers";
import { cache } from "react";

/**
 * Reads the current session from the incoming request's cookies. Wrapped in
 * React's `cache()` so multiple calls within one request (layout + page,
 * etc.) share a single lookup instead of re-querying the session store.
 *
 * The answer may come from the session's signed cookie copy, up to
 * `SESSION_COOKIE_CACHE_SECONDS` old — see `getFreshSession`.
 */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

/**
 * The session read from the database, skipping the cookie copy that
 * `getSession` may answer from. Use it wherever a stale role would matter:
 * every admin check.
 */
export const getFreshSession = cache(async () =>
  auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  }),
);

/**
 * Rewrites the session's cookie copy from the database. Call it from a
 * Server Action after changing a user field the session carries (e.g. the
 * name), so the next page doesn't show the old value.
 */
export async function refreshSessionCache() {
  await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
}

export { isAdmin } from "./is-admin";
