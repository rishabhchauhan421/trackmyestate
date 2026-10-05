import { Avatar } from "~/app/_components/avatar";
import { PageHeader } from "~/app/_components/page-header";
import { DEFAULT_TIME_ZONE } from "~/lib/time-zone";
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

      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <ul className="divide-y divide-line-soft">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  initials={user.name.charAt(0).toUpperCase()}
                  className="size-9 shrink-0 bg-accent text-white"
                />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-medium text-ink">
                    {user.name}
                    {user.role === "admin" && (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-strong">
                        Admin
                      </span>
                    )}
                    {user.banned && (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
                        Banned
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted">{user.email}</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-6 text-right">
                <div>
                  <p className="text-sm font-medium text-ink">
                    {user.propertyCount + user.investmentCount + user.loanCount}
                  </p>
                  <p className="text-xs text-muted">assets tracked</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-ink">
                    {formatDate(user.createdAt, DEFAULT_TIME_ZONE)}
                  </p>
                  <p className="text-xs text-muted">joined</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
