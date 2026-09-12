import { redirect } from "next/navigation";

import { AppShell } from "~/app/_components/app-shell";
import { getSession, isAdmin } from "~/server/better-auth/server";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const name = session.user?.name ?? session.user?.email ?? "Your account";
  const initial = name.charAt(0).toUpperCase();

  return (
    <AppShell
      name={name}
      email={session.user?.email}
      initial={initial}
      isAdmin={isAdmin(session.user)}
    >
      {children}
    </AppShell>
  );
}
