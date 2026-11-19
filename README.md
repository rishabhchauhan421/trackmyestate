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

- A **`Household`** owns the portfolio: `Property`, `Policy`, `Investment`,
  `Loan`, `BillSchedule`, `Bill`, `Document` and `PaymentTransaction` rows carry
  a `householdId`, and pages and actions look records up by household (via
  `requireScope` in `src/server/households.ts`), so a portfolio can be shared.
  Each user gets a personal household on first use (`HouseholdMember` links
  users to households). `ownerId` stays on each record as its creator. A
  `User` keeps their own settings: `timezone` (for "today" and reminder send
  times), reminder rules and guests.
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
- **Dates:** a date-only value (due date, purchase date, lease start…) is
  stored as midnight UTC of its calendar day — exactly what an
  `<input type="date">` value parses to — and always read back as that day
  (`src/lib/calendar-day.ts`). Only "today" depends on a time zone: the
  user's, from Settings. `createBill` takes a `"YYYY-MM-DD"` day, not a
  `Date`, so a bill can't land on the wrong day.
- **Soft deletes:** most models carry `deletedAt`, and `src/server/db.ts`
  adds the not-deleted filter to every read on them automatically (see
  `src/server/soft-delete.ts`). A query that names `deletedAt` itself is left
  alone.
- **Money** is stored in minor units (paise) as whole numbers in `Float`
  columns (`src/lib/money.ts` explains why not `Int`). Forms parse rupees with
  `money`/`optionalMoney` from `src/lib/form.ts`; `formatINR` takes paise.
- **Bills are generated once:** `Bill.generationKey` is unique
  (`<scheduleId>:<day>` for a schedule's bills), so overlapping generator runs
  can't duplicate a bill.

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
   Open http://localhost:3000 and sign in with Google, or sign up with
   email and password at `/sign-up`. Email accounts must confirm their address
   first: without `RESEND_API_KEY` the verification link is printed in the
   server console.

**Important:** after any `prisma/schema.prisma` change, run `pnpm db:push` _and_
restart `pnpm dev`. The dev server caches a single `PrismaClient` instance across
hot reloads (see `src/server/db.ts`), so it keeps the pre-change client — missing
new models/fields — until the process itself restarts, not just the file.

`pnpm start` serves the last `pnpm build` and never picks up code changes — use
`pnpm dev` while developing.

## Scripts

| Command                                            | What it does                                                 |
| -------------------------------------------------- | ------------------------------------------------------------ |
| `pnpm dev`                                         | Dev server with hot reload                                   |
| `pnpm build` / `pnpm start`                        | Production build / serve it                                  |
| `pnpm check`                                       | ESLint + `tsc --noEmit`                                      |
| `pnpm lint` / `pnpm lint:fix`                      | ESLint only (the `next lint` command was removed in Next 16) |
| `pnpm typecheck`                                   | TypeScript only                                              |
| `pnpm test` / `pnpm test:watch`                    | Jest                                                         |
| `pnpm format:check` / `pnpm format:write`          | Prettier                                                     |
| `pnpm db:push` / `pnpm db:seed` / `pnpm db:studio` | Prisma                                                       |

## Deploying a schema change

Some releases need existing data reshaped before the new code can read it.
`scripts/migrate-data.ts` holds those one-off steps; each runs once and is
recorded in the `AppMigration` collection, so running the script again is
safe. For a release that changes `prisma/schema.prisma`:

```bash
pnpm tsx scripts/migrate-data.ts --dry-run  # see what would change
pnpm tsx scripts/migrate-data.ts            # reshape the data
pnpm db:push                                # then create the new indexes
```

Then deploy the code. The November 2026 steps give every bill a unique
`generationKey` (soft-deleting any duplicate bills found), convert money from
rupees to paise, create a personal household for every user, and give every
active lease a rent schedule. `pnpm db:push` also creates the indexes for
`BillSchedule.nextDueDate`, `EmailSuppression`, `CronRun` and the auth
rate-limit tables.

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
  signs out every other session). Email sign-ups must verify their address
  before signing in, and sign-in, sign-up, reset and verification emails are
  rate limited per IP and per address (`src/server/rate-limit.ts`, stored in
  MongoDB). Every `(app)` route is guarded server-side.
- **Dashboard** — net worth, insurance cover, next-30-days in/out, portfolio mix,
  a "needs attention" list (overdue or due within 7 days) and the next six dates.
- **Timeline** — every bill, filterable by period and by inflow/outflow, plus
  "projected" rows for what active schedules will bill later in the range.
- **Bills** — one page per bill (`/bills/[id]`): its asset, status, payments
  and a "Record payment" form (part payments; a settled EMI reduces the
  loan's outstanding balance).
- **Properties** — totals, type filters and cards; a detail page with key figures
  (value, rent, rental yield, open bills), current lease and bills; add/edit.
  Per property: **leases**, **rental units** and **utilities** (recurring bill
  schedules with recipients; amounts of variable utilities show as "Approx." until
  paid; first due date can't be in the past).
- **Insurance, Investments, Loans** — lists with add/edit/delete. A policy
  can have a premium schedule and a payout; an investment an expected
  return; a lease its monthly rent. Each becomes bills and reminders.
- **Documents** — lists `Document` rows (no upload flow yet).
- **Settings** — four tabs: **General** (name, time zone, currency),
  **Reminders** (when and how, per kind of payment — see below),
  **Channels** (email with a test send, mobile number for the coming
  SMS/WhatsApp, reminder send time) and **Guests** (people who get reminders
  without an account — see below).
- **Admin** — platform overview, user list, background jobs, and the
  notification log (`/admin/notifications`: every reminder by channel —
  email, SMS, WhatsApp — and status, with search; open one for the message,
  its delivery history, provider id and last error, and retry a failed one
  or cancel a queued one).

Every form validates on the server with zod (field helpers in `src/lib/form.ts`).
A validation problem is thrown as a `FormError` and shown on the form: each
action has a `…Form` twin wrapped in `toFormState` (`src/server/form-state.ts`),
which `ActionForm` (`src/app/_components/action-form.tsx`) calls through
`useActionState` without clearing what the user typed. Anything else that
goes wrong reaches the `error.tsx` boundaries.

Amounts are shown in the record's currency, or the user's (Settings ›
General) when it has none, and totals are kept per currency
(`src/lib/money-totals.ts`) rather than added across currencies.

## Bills

Recurring schedules (`BillSchedule`: utilities, loan EMIs…) become actual
`Bill` rows through the **bill generator** (`src/server/bills/generate.ts`).
Each run creates every missing bill due from 31 days ago to 35 days ahead,
in each owner's time zone — enough for the earliest reminder, and enough to
catch up after missed runs. It never creates the same schedule-and-day bill
twice, so it's safe to run any number of times.

- It runs daily from **`/api/cron/bills`** (see [Scheduled
  jobs](#scheduled-jobs)), reading only schedules whose stored
  `nextDueDate` falls within the horizon.
- **Admin › Jobs** (`/admin/jobs`) runs it — or the reminder and sending
  jobs — on demand, and shows their queues.
- A new utility, loan, lease, premium, payout or expected return generates
  its first bills straight away.
- Every asset action changes schedules through one place,
  `src/server/schedules/lifecycle.ts`: changing the terms removes the
  upcoming unpaid bills so they're regenerated from the new terms, ending
  or deleting an asset retires its schedules, and paid bills are never
  touched.

A schedule's dates come from `src/lib/schedule.ts`: anchored on its
`startDate` (first due date; a loan's first EMI after it starts),
month-based schedules fall on `dueDay` (clamped to short months), weekly
ones step from the start, and an EMI's `tenureMonths` caps it with
numbered instalments. Users see each utility's and loan's **next bill** —
the earliest unpaid bill, or the schedule's next date before one exists.

## Reminders

A reminder is a signed number of days from a bill's due date — `-7` is a week
before, `0` the due day, `+3` a follow-up three days after (sent only while the
bill is still unpaid).

- **Defaults per kind of payment** live in code (`src/lib/reminders.ts`), e.g.
  premiums 30, 7 and 1 day before plus 1 day after. A user changes them in
  **Settings › Reminders**; only changed kinds are stored, as `NotificationRule`
  rows, so improving a default reaches everyone who hasn't customised it.
- **`/api/cron/reminders`** (hourly — see [Scheduled jobs](#scheduled-jobs)) runs `generateReminders`
  (`src/server/reminders/generate.ts`): for each unpaid bill near its due date it
  counts days in the owner's time zone and queues a `NotificationJob` per matching
  reminder, for 9 am local time. Idempotency keys make re-runs harmless.
- **`/api/cron/notifications`** (every 15 minutes) sends due jobs in batches
  (`src/server/notifications/process.ts`), reclaims jobs stuck mid-send, retries
  failures with backoff (5, 10, 20 min), cancels a reminder whose bill was paid
  since it was queued, and deletes finished jobs after 90 days.
- **Guests** (`Guest` model, Settings › Guests) get the owner's reminders for
  the kinds of payment — and optionally the properties — they were added for,
  on the owner's schedule or only on the due day. They get one welcome email
  when added (queued and sent at once through the same notification queue),
  and every email carries a signed "stop these reminders" link to the public
  `/reminders/stop` page. A guest who stops can't be resumed by the owner.
- **Utility recipients** get the same signed stop link in every reminder.
- **Suppression list:** stopping adds the address to `EmailSuppression`,
  for that owner or, if they choose, for everyone. Reminders and welcome
  emails to a suppressed address aren't queued, and a queued one is
  cancelled before sending, so deleting and re-adding a guest doesn't
  restart the emails. An owner can have up to 25 guests and add 10 new
  guest addresses a day (`src/server/guests/invites.ts`).
- **Channels:** email is live (Resend). SMS and WhatsApp numbers can be saved
  for the owner and guests, but nothing is sent to them until those
  providers are connected; push is a placeholder.
- **Send time:** 9 am by default, or the owner's choice in Settings ›
  Channels, in their time zone.

### Scheduled jobs

Vercel Cron runs every job on its own schedule (`vercel.json`, Vercel Pro):

| Schedule                     | Calls                     | Does                         |
| ---------------------------- | ------------------------- | ---------------------------- |
| Every 15 minutes             | `/api/cron/notifications` | Sends due reminders          |
| Hourly at :05                | `/api/cron/reminders`     | Queues today's reminders     |
| Daily, 03:00 UTC (08:30 IST) | `/api/cron/bills`         | Generates the upcoming bills |

Every cron route requires `Authorization: Bearer $CRON_SECRET` (Vercel Cron
sends it), and every job is idempotent, so late, repeated or overlapping
runs are harmless. `/api/cron/daily` runs all three in order for a manual
catch-up, and the GitHub Actions workflow (`.github/workflows/cron.yml`)
can call any of them by hand.

**How the jobs behave:**

- A schedule bills each period (a month, or a weekly schedule's day) once,
  so moving a due day never bills a month twice. It never bills days before
  its terms were last set (`BillSchedule.billFrom`).
- A record that throws is skipped, logged and retried next run; the rest of
  the run goes ahead.
- A reminder missed yesterday (the job didn't run, or the bill is new) is
  queued today. Everyone in the bill's household gets the owner's reminders.
- One person's due reminders go out as a single email. Each send carries an
  idempotency key, so a run that dies mid-send can't email twice. When the
  provider rate limits, the run stops and the rest wait for the next one
  without losing an attempt.
- Each run has four minutes (`maxDuration` is 300 seconds, which needs
  Vercel Pro); what's left over is picked up by the next run.

**Health:** each run is recorded in `CronRun`. `GET /api/health/cron`
returns 200 when all is well and 503, saying why, when a job hasn't
succeeded within two of its intervals (`late`), a job's last run skipped
records that threw (`warnings`), a due reminder has waited over an hour
(`sending.stuck`), or most reminders in the last 24 hours failed
(`sending.failing`). Point an uptime monitor at it to be alerted. Admins see each job's last success, and can run any job, in
**Admin › Jobs**, and see what was sent (or why it failed) in **Admin ›
Notifications**.

## Design system

All UI follows the design system in [`docs/design/README.md`](docs/design/README.md)
— semantic color tokens in `src/styles/globals.css`, shared components in
`src/app/_components/`, and the Claude Design reference screens in
[`docs/design/canvas/`](docs/design/canvas/). `AGENTS.md` points coding agents
there too.

## What's next

- WhatsApp and SMS delivery (a provider such as Twilio/MSG91/Meta), with
  phone verification and WhatsApp opt-in for owners and guests; quiet hours
  and the weekly digest; per-item reminder overrides. Existing per-utility
  recipients could then be folded into Guests.
- Sharing a household: inviting a member, and sending reminders to every
  member rather than only the owner.
- Choosing a currency per property, policy or investment (records follow the
  user's currency until then), and conversion for totals across currencies.
- Reminders anchored on a premium's grace-period end (`Bill.gracePeriodDays`).
- Document upload; "Mark paid" links inside reminder emails.

## Testing

```bash
pnpm test        # run once
pnpm test:watch  # watch mode
```

Jest + Testing Library, with the Prisma client mocked via `jest-mock-extended`
(`src/server/__mocks__/db.ts`) — no test touches the real database. Covers the
query layer, server actions, the reminder and notification engines, and the
shared components.
