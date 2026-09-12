import { redirect } from "next/navigation";

import { getSession, isAdmin } from "~/server/better-auth/server";

/**
 * Everything under `/admin` is platform-wide (all users, not just the
 * signed-in one) — gate it here so no page beneath this layout needs to
 * repeat the check. `(app)/layout.tsx` already redirects signed-out
 * visitors to `/login`; this only adds the admin-role check on top.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdmin(session.user)) redirect("/dashboard");

  return <>{children}</>;
}
