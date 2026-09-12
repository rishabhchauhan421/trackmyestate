/**
 * One-off bootstrap for the first admin: there's no UI for granting admin
 * access (a non-admin can't reach `/admin` to grant it to themselves), so
 * the very first promotion has to happen directly against the database.
 * Once at least one admin exists, further promotions can go through
 * `auth.api.setRole` from an authenticated admin session instead.
 *
 * Run with: pnpm tsx scripts/set-admin-role.ts <email> [role]
 *
 * Example: pnpm tsx scripts/set-admin-role.ts abc@xyz.com
 * (role defaults to "admin"; the account must have signed in at least once
 * so its User row exists — log out/in afterwards to refresh the session)
 */
import { PrismaClient } from "../generated/prisma";

const db = new PrismaClient();

async function main() {
  const [email, role = "admin"] = process.argv.slice(2);
  if (!email) {
    console.error("Usage: pnpm tsx scripts/set-admin-role.ts <email> [role]");
    process.exitCode = 1;
    return;
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user found with email "${email}"`);
    process.exitCode = 1;
    return;
  }

  await db.user.update({ where: { id: user.id }, data: { role } });
  console.log(`${email} is now "${role}"`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
