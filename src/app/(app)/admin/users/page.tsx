import { Avatar } from "~/app/_components/avatar";
import { PageHeader } from "~/app/_components/page-header";
import { formatDate } from "~/lib/format";
import { listUsers } from "~/server/queries/admin";

export default async function AdminUsersPage() {
  const users = await listUsers();

  return (
    <>
      <PageHeader
        title="Users"
        description={`${users.length} signed-up user${users.length === 1 ? "" : "s"}, newest first.`}
      />

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  initials={user.name.charAt(0).toUpperCase()}
                  className="size-9 shrink-0 bg-blue-600 text-white"
                />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {user.name}
                    {user.role === "admin" && (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-500/15 dark:text-blue-300">
                        Admin
                      </span>
                    )}
                    {user.banned && (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-500/15 dark:text-red-300">
                        Banned
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-6 text-right">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {user.propertyCount + user.investmentCount + user.loanCount}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    assets tracked
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {formatDate(user.createdAt)}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">joined</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
