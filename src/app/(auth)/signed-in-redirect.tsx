import { redirect } from "next/navigation";

import { getSession } from "~/server/better-auth/server";

/**
 * Sends someone who is already signed in to their dashboard. It renders
 * nothing, and sits behind a `<Suspense>` boundary so reading the session
 * doesn't hold up the page around it, which is prerendered.
 */
export async function SignedInRedirect() {
  if (await getSession()) redirect("/dashboard");
  return null;
}
