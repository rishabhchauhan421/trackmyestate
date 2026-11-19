import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getSessionCookie } from "better-auth/cookies";

import { auth } from "~/server/better-auth";
import { isAdmin } from "~/server/better-auth/is-admin";

/** better-auth's cookie copy of the session, whole or split into chunks. */
const SESSION_CACHE_COOKIE = /^(__Secure-)?better-auth\.session_data(\.\d+)?$/;

/**
 * Auth gate for the signed-in app shell. An unauthenticated visitor (no
 * session cookie) is redirected before any `(app)` Server Component runs.
 * `(app)/layout.tsx`'s `getSession()` call remains the authoritative check.
 *
 * It also keeps the session's cookie copy alive (see `session.cookieCache`
 * in `~/server/better-auth/config`). Pages read the session from that copy
 * instead of the database, but Server Components can't write cookies, so
 * once the browser drops the expired copy this is where it is written
 * again: one database lookup here, then none until it next expires. A
 * request that still carries the copy passes straight through.
 *
 * `/admin/:path*` always gets a database-backed lookup, so a non-admin is
 * turned away before any admin Server Component or query runs, and a
 * removed admin role applies at once.
 *
 * It also swaps the static homepage for its session-aware copy when the
 * visitor has a session cookie.
 *
 * Proxy runs on the Node.js runtime, so the Prisma round trip in
 * `auth.api.getSession` works here, and the cookies better-auth sets
 * during it (through its `nextCookies` plugin) are added to the response.
 */
export async function proxy(request: NextRequest) {
  // The homepage is static. Someone with a session cookie gets the
  // session-aware copy at `/home` instead, under the same address; the
  // matcher only sends `/` here when that cookie is present.
  if (request.nextUrl.pathname === "/") {
    return NextResponse.rewrite(new URL("/home", request.url));
  }

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const isAdminPath = request.nextUrl.pathname.startsWith("/admin");
  const hasSessionCache = request.cookies
    .getAll()
    .some((cookie) => SESSION_CACHE_COOKIE.test(cookie.name));

  if (isAdminPath || !hasSessionCache) {
    const session = await auth.api.getSession({
      headers: request.headers,
      query: { disableCookieCache: true },
    });
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (isAdminPath && !isAdmin(session.user)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/bills/:path*",
    "/timeline/:path*",
    "/properties/:path*",
    "/insurance/:path*",
    "/investments/:path*",
    "/loans/:path*",
    "/documents/:path*",
    "/settings/:path*",
    "/admin/:path*",
    // `/` only for visitors with a session cookie (its name has a
    // `__Secure-` prefix over HTTPS), so signed-out visitors and crawlers
    // get the static page straight from the CDN without running this.
    {
      source: "/",
      has: [{ type: "cookie", key: "better-auth.session_token" }],
    },
    {
      source: "/",
      has: [{ type: "cookie", key: "__Secure-better-auth.session_token" }],
    },
  ],
};
