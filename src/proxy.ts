import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getSessionCookie } from "better-auth/cookies";

import { auth } from "~/server/better-auth";
import { isAdmin } from "~/server/better-auth/is-admin";

/**
 * Optimistic auth gate for the signed-in app shell: checks only for the
 * session cookie (no DB round trip), so an unauthenticated visitor is
 * redirected before any `(app)` Server Component runs. The cookie can be
 * stale, so `(app)/layout.tsx`'s `getSession()` call remains the
 * authoritative check.
 *
 * `/admin/:path*` additionally gets a real (DB-backed) session lookup here,
 * so a non-admin is turned away before any admin Server Component or query
 * runs, rather than relying solely on `(app)/admin/layout.tsx`. Proxy runs
 * on the Node.js runtime by default in this Next.js version, so the Prisma
 * round trip in `auth.api.getSession` works here (it couldn't in the old
 * Edge-only `middleware`).
 */
export async function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (request.nextUrl.pathname.startsWith("/admin")) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (!isAdmin(session.user)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/timeline/:path*",
    "/properties/:path*",
    "/insurance/:path*",
    "/investments/:path*",
    "/loans/:path*",
    "/documents/:path*",
    "/settings/:path*",
    "/admin/:path*",
  ],
};
