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
 */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

export { isAdmin } from "./is-admin";
