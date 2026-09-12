import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic auth gate for the signed-in app shell: checks only for the
 * session cookie (no DB round trip), so an unauthenticated visitor is
 * redirected before any `(app)` Server Component runs. The cookie can be
 * stale, so `(app)/layout.tsx`'s `getSession()` call remains the
 * authoritative check.
 */
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
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
  ],
};
