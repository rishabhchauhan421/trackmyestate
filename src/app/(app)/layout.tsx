import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AdminNav, AppShell } from "~/app/_components/app-shell";
import { Avatar } from "~/app/_components/avatar";
import { Bone } from "~/app/_components/skeleton";
import { getSession, isAdmin } from "~/server/better-auth/server";

/**
 * The signed-in user as the shell shows them. `src/proxy.ts` has already
 * turned away visitors without a session cookie; this is the authoritative
 * check, and every page repeats it through `requireScope`.
 */
async function getShellUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  const name = session.user.name ?? session.user.email ?? "Your account";
  return {
    name,
    email: session.user.email,
    initial: name.charAt(0).toUpperCase(),
    isAdmin: isAdmin(session.user),
  };
}

async function UserAvatar({
  className,
  square,
}: {
  className: string;
  square?: boolean;
}) {
  const { initial } = await getShellUser();
  return <Avatar initials={initial} className={className} square={square} />;
}

/** Name and email, as the account menu's heading shows them. */
async function AccountHeading() {
  const { name, email } = await getShellUser();
  return (
    <>
      <p className="truncate text-sm font-semibold text-ink">{name}</p>
      {email && <p className="truncate text-xs text-muted">{email}</p>}
    </>
  );
}

/** Name and email, as the sidebar's footer shows them. */
async function AccountSummary() {
  const { name, email } = await getShellUser();
  return (
    <>
      <span className="block truncate text-sm/5 font-semibold text-white">
        {name}
      </span>
      {email && (
        <span className="block truncate text-xs/5 font-normal text-night-muted">
          {email}
        </span>
      )}
    </>
  );
}

async function AdminNavForAdmins() {
  const user = await getShellUser();
  return user.isAdmin ? <AdminNav /> : null;
}

/**
 * The signed-in frame. The sidebar and navigation are the same for
 * everyone, so they are prerendered and appear at once; the few parts that
 * name the user read the session behind their own `<Suspense>` boundaries
 * and stream in, as does the page itself.
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const smallAvatar = "bg-night-3 text-white";
  const largeAvatar = "size-9 bg-night-3 text-white";

  return (
    <AppShell
      navbarAvatar={
        <Suspense fallback={<Avatar className={smallAvatar} square />}>
          <UserAvatar className={smallAvatar} square />
        </Suspense>
      }
      sidebarAvatar={
        <Suspense fallback={<Avatar className={largeAvatar} />}>
          <UserAvatar className={largeAvatar} />
        </Suspense>
      }
      accountHeading={
        <Suspense fallback={<Bone className="h-4 w-32" />}>
          <AccountHeading />
        </Suspense>
      }
      accountSummary={
        <Suspense fallback={<Bone className="h-4 w-28 bg-night-3" />}>
          <AccountSummary />
        </Suspense>
      }
      adminNav={
        <Suspense fallback={null}>
          <AdminNavForAdmins />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
