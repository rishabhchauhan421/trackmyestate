# TrackMyEstate

A personal asset & reminder hub for people with a lot going on — several properties,
many insurance policies, and a spread of investments and loans. Everything lands in
one place, and every payment date and expected return flows into a single timeline.
The promise, in one line: **aggregate everything, and never miss a date.**

Stack: Next.js 16.3.4 (App Router, Turbopack) · TypeScript · Prisma · MongoDB ·
Tailwind CSS 4 · zod 4. Auth is [better-auth](https://better-auth.com), with Google
OAuth and email/password (including password reset). Email goes out through
[Resend](https://resend.com).

## Data model in one breath

- `User` owns `Property`, `Policy`, `Investment`, `Loan` and `Document` rows
  directly (no shared supertype), plus a `timezone` used for "today" and reminder
  send times.
- `Property` has rental units (`Room`) and `Lease`s, with the tenant's details on
  the lease itself.
- **`BillSchedule`** is a recurring template — a utility, a loan's EMI schedule, a
  policy premium, a lease's rent (`category` says which). A utility schedule can't
  be edited once created, only deactivated.
- **`Bill`** is one dated amount, owed or expected (`direction`: outflow/inflow),
  for any asset — utility bills, EMIs, premiums, rent, payouts, returns, claims.
  Exactly one asset link (`propertyId`, `leaseId`, `loanId`, `policyId`,
  `investmentId`) is set, matching `category`. The dashboard and timeline are
  queries over bills.
- **`NotificationRule`** is one reminder (see [Reminders](#reminders)) and
  **`NotificationJob`** one queued message.
- `PaymentTransaction` and `AuditLog` exist in the schema but aren't wired up yet.
- Most models carry `deletedAt` for soft deletes, and money fields an optional
  `Currency` (everything renders as INR today). Money fields are `Float`.

## Getting started

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Copy env and fill in values:
   ```bash
   cp .env.example .env
   ```
   `src/env.js` validates these at startup — the app won't boot without them:
   - `DATABASE_URL` — a MongoDB connection string. Prisma needs a replica set
     (MongoDB Atlas works out of the box).
   - `BETTER_AUTH_SECRET` — `openssl rand -base64 32`.
   - `BETTER_AUTH_URL` — e.g. `http://localhost:3000`.
   - `BETTER_AUTH_GOOGLE_CLIENT_ID` / `BETTER_AUTH_GOOGLE_CLIENT_SECRET` — from a
     Google Cloud OAuth client, for "Continue with Google".

   Required in production, optional locally: `RESEND_API_KEY` (without it, emails
   such as password-reset links are logged to the server console instead) and
   `CRON_SECRET` (authenticates the cron routes).
3. Push the schema (MongoDB has no migrations — `db push` syncs indexes and
   collections directly):
   ```bash
   pnpm db:push
   ```
4. Seed demo data — three sample portfolios (properties, policies, investments,
   loans, utilities and their bills):
   ```bash
   pnpm db:seed
   ```
   Two of the seeded users (`ananya.rao@example.in`, `vikram.mehta@example.in`) are
   illustrative only — they have no real login. The third is seeded with a fixed
   user id matching a real email (see `prisma/seed.ts`), so signing in with that
   Google account links to its seeded portfolio instead of creating a fresh, empty
   user. Swap that email/id for your own if you want to see seeded data through your
   own login.
5. Run:
   ```bash
   pnpm dev
   ```
   Open http://localhost:3000 and sign in with Google (or register with
   email/password).

**Important:** after any `prisma/schema.prisma` change, run `pnpm db:push` *and*
restart `pnpm dev`. The dev server caches a single `PrismaClient` instance across
hot reloads (see `src/server/db.ts`), so it keeps the pre-change client — missing
new models/fields — until the process itself restarts, not just the file.

`pnpm start` serves the last `pnpm build` and never picks up code changes — use
`pnpm dev` while developing.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server with hot reload |
| `pnpm build` / `pnpm start` | Production build / serve it |
| `pnpm check` | ESLint + `tsc --noEmit` |
| `pnpm lint` / `pnpm lint:fix` | ESLint only (the `next lint` command was removed in Next 16) |
| `pnpm typecheck` | TypeScript only |
| `pnpm test` / `pnpm test:watch` | Jest |
| `pnpm format:check` / `pnpm format:write` | Prettier |
| `pnpm db:push` / `pnpm db:seed` / `pnpm db:studio` | Prisma |

## Granting the first admin

`/admin` (user list, roles, bans — via better-auth's `admin` plugin) is gated
server-side by `User.role === "admin"` (see `src/server/better-auth/is-admin.ts`).
There's no in-app way to self-promote — a non-admin can't reach `/admin` to grant
it to themselves — so the first admin has to be set directly against the database:

```bash
pnpm tsx scripts/set-admin-role.ts <email> [role]
```

The account must already have signed in at least once (a `User` row has to exist).
`role` defaults to `"admin"` if omitted. Log out and back in afterwards so the
session picks up the new role. Once at least one admin exists, further promotions
can go through the admin UI (`auth.api.setRole`) instead of the script.

## What's built

- **Auth** — sign in / sign up / sign out (Google OAuth + email/password) and
  **forgot / reset password** (single-use emailed link valid for 1 hour; resetting
  signs out every other session). Every `(app)` route is guarded server-side.
- **Dashboard** — net worth, insurance cover, next-30-days in/out, portfolio mix,
  a "needs attention" list (overdue or due within 7 days) and the next six dates.
- **Timeline** — every bill, filterable by period and by inflow/outflow.
- **Properties** — totals, type filters and cards; a detail page with key figures
  (value, rent, rental yield, open bills), current lease and bills; add/edit.
  Per property: **leases**, **rental units** and **utilities** (recurring bill
  schedules with recipients; amounts of variable utilities show as "Approx." until
  paid; first due date can't be in the past).
- **Insurance, Investments, Loans** — lists with add/edit/delete.
- **Documents** — lists `Document` rows (no upload flow yet).
- **Settings** — **Region** (time zone, with "use this device's") and
  **Reminders** (see below).
- **Admin** — platform overview and user list.

Every form validates on the server with zod (field helpers in `src/lib/form.ts`).

## Reminders

A reminder is a signed number of days from a bill's due date — `-7` is a week
before, `0` the due day, `+3` a follow-up three days after (sent only while the
bill is still unpaid).

- **Defaults per kind of payment** live in code (`src/lib/reminders.ts`), e.g.
  premiums 30, 7 and 1 day before plus 1 day after. A user changes them in
  **Settings › Reminders**; only changed kinds are stored, as `NotificationRule`
  rows, so improving a default reaches everyone who hasn't customised it.
- **`/api/cron/reminders`** (hourly) runs `generateReminders`
  (`src/server/reminders/generate.ts`): for each unpaid bill near its due date it
  counts days in the owner's time zone and queues a `NotificationJob` per matching
  reminder, for 9 am local time. Idempotency keys make re-runs harmless.
- **`/api/cron/notifications`** (every 15 minutes) sends due jobs in batches
  (`src/server/notifications/process.ts`), reclaims jobs stuck mid-send, retries
  failures with backoff (5, 10, 20 min), cancels a reminder whose bill was paid
  since it was queued, and deletes finished jobs after 90 days.
- **Channels:** email is live (Resend); WhatsApp, SMS and push are placeholders.

Both cron routes require `Authorization: Bearer $CRON_SECRET` and are scheduled
in `vercel.json`.

## Design system

All UI follows the design system in [`docs/design/README.md`](docs/design/README.md)
— semantic color tokens in `src/styles/globals.css`, shared components in
`src/app/_components/`, and the Claude Design reference screens in
[`docs/design/canvas/`](docs/design/canvas/). `AGENTS.md` points coding agents
there too.

## What's next

- The job that generates `Bill` rows from `BillSchedule`s ahead of time (the date
  logic exists in `src/lib/recurrence.ts`). Until it runs, reminders only cover
  bills already in the database.
- WhatsApp and SMS delivery, with phone verification and opt-in; guests who get
  reminders without an account; per-item reminder overrides. The redesigned
  Settings (General · Reminders · Channels · Guests) is in the design canvas.
- Reminders anchored on a premium's grace-period end (`Bill.gracePeriodDays`).
- Document upload; "Mark paid" links inside reminder emails.
- Surfacing `Currency` and `PaymentTransaction` in the UI.

## Testing

```bash
pnpm test        # run once
pnpm test:watch  # watch mode
```

Jest + Testing Library, with the Prisma client mocked via `jest-mock-extended`
(`src/server/__mocks__/db.ts`) — no test touches the real database. Covers the
query layer, server actions, the reminder and notification engines, and the
shared components.
