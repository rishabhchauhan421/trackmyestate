import { requireAdminSession } from "~/server/better-auth/server";

/**
 * Everything under `/admin` is platform-wide (all users, not just the
 * signed-in one). `src/proxy.ts` turns non-admins away before anything
 * here runs; this repeats the check, and so does every page beneath it
 * (see `requireAdminSession`).
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireAdminSession();

  return <>{children}</>;
}
