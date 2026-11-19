import { type Metadata } from "next";

import { getSession } from "~/server/better-auth/server";
import { Home, homeMetadata } from "../_home/home";

// Same page as `/`, so search engines should only know that address.
export const metadata: Metadata = {
  ...homeMetadata,
  robots: { index: false, follow: true },
};

/**
 * The homepage for a signed-in visitor: the header offers "Open dashboard"
 * and "Sign out" instead of "Sign in". `src/proxy.ts` serves this at `/`
 * to anyone with a session cookie; everyone else gets the static
 * `src/app/page.tsx`.
 */
export default async function SignedInHomePage() {
  return <Home session={await getSession()} />;
}
