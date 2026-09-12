/**
 * Split out from `./server` (which re-exports it) so it has no dependency
 * on the `auth` instance/better-auth itself — that pulls in an ESM-only
 * module graph that can't be `require()`d, which broke Jest for anything
 * importing `./server` directly. This file has no such import, so it stays
 * trivially testable.
 */

/**
 * Whether `user` (from a `getSession()` result) has admin access — the
 * better-auth `admin` plugin's default single role, "admin". Existing users
 * have no `role` set at all and are correctly non-admin. Promote a user with
 * `pnpm tsx scripts/set-admin-role.ts <email>`.
 */
export function isAdmin(
  user: { role?: string | null } | null | undefined,
): boolean {
  return user?.role === "admin";
}
