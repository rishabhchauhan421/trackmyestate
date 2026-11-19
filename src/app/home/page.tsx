import { type Metadata } from "next";
import { Suspense } from "react";

import { getSession } from "~/server/better-auth/server";
import { SiteHeader } from "../_components/site-header";
import { Home, homeMetadata } from "../_home/home";

// Same page as `/`, so search engines should only know that address.
export const metadata: Metadata = {
  ...homeMetadata,
  robots: { index: false, follow: true },
};

async function SignedInHeader() {
  return <SiteHeader session={await getSession()} />;
}

/**
 * The homepage for a signed-in visitor: the header offers "Open dashboard"
 * and "Sign out" instead of "Sign in". `src/proxy.ts` serves this at `/`
 * to anyone with a session cookie; everyone else gets the static
 * `src/app/page.tsx`. The page is prerendered with the signed-out header,
 * and the signed-in one replaces it once the session has been read.
 */
export default function SignedInHomePage() {
  return (
    <Home
      header={
        <Suspense fallback={<SiteHeader session={null} />}>
          <SignedInHeader />
        </Suspense>
      }
    />
  );
}
