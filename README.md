# TrackMyEstate

A personal asset & reminder hub for people with a lot going on — several properties,
many insurance policies, and a spread of investments and loans. Everything lands in
one place, and every payment date and expected return flows into a single timeline.
The promise, in one line: **aggregate everything, and never miss a date.**

Stack: Next.js 16.3.4 (App Router, Turbopack) · TypeScript · Prisma · MongoDB ·
Tailwind CSS 4. Auth is [better-auth](https://better-auth.com), with Google OAuth
and email/password both enabled.

## Data model in one breath

- `User` owns `Property`, `Policy`, `Investment`, `Loan`, `Document` and
  `FinancialEvent` rows directly (no shared supertype).
- Each domain has its own payment children: `Property` → `Tenant`/`RentPayment` and
  `Utility`/`UtilityBill`; `Policy` → `PremiumPayment`/`Payout`/`Claim`; `Loan` →
  `EMIPayment`.
- `Utility` is a **template** (type, provider, recurrence, amount, reminder lead
  time) — it can't be edited once created, only deactivated. `UtilityBill` is the
  actual generated instance a notification goes out for. Owners never create a bill
  directly; a background job is meant to generate one per utility on the date of its
  first notification (the job itself isn't built yet — see "What's next").
- `FinancialEvent` is the spine: every dated inflow/outflow (rent, bills, premiums,
  EMIs, returns, claim settlements). The timeline is a query over it.
- `NotificationRule` / `NotificationJob`, `PaymentTransaction` and `AuditLog` exist
  in the schema for a future notification engine, payment ledger and audit trail —
  none are wired up to the app yet.
- Every model carries a `deletedAt` for soft deletes, and most money fields carry an
  optional `Currency` (multi-currency is modeled but not yet surfaced in the UI —
  everything renders as INR today).
- Money fields are `Float`.

## Getting started

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Copy env and fill in values:
   ```bash
   cp .env.example .env
   ```
   `src/env.js` validates these at startup — the app won't boot if any are missing,
   and a couple aren't in `.env.example` yet:
   - `DATABASE_URL` — a MongoDB connection string (`mongodb+srv://...` or
     `mongodb://...`). `.env.example`'s placeholder is a stale Postgres URL left
     over from an earlier version of this project — the schema now targets
     MongoDB.
   - `BETTER_AUTH_SECRET` — `openssl rand -base64 32`.
   - `BETTER_AUTH_URL` — e.g. `http://localhost:3000`. **Not in `.env.example`** —
     add it yourself, or startup fails.
   - `BETTER_AUTH_GOOGLE_CLIENT_ID` / `BETTER_AUTH_GOOGLE_CLIENT_SECRET` — from a
     Google Cloud OAuth client. Needed for the "Sign in with Google" button.
   - `BETTER_AUTH_GITHUB_CLIENT_ID` / `BETTER_AUTH_GITHUB_CLIENT_SECRET` — required
     by the env schema but **not wired to any provider** in
     `src/server/better-auth/config.ts` (no GitHub login exists). Any non-empty
     placeholder value works.
3. Push the schema (MongoDB has no migrations — `db push` syncs indexes/collections
   directly):
   ```bash
   pnpm db:push
   ```
4. Seed demo data — three sample portfolios (properties, policies, investments,
   loans, utilities and their generated bills):
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

## What's built

- Sign in / sign up / sign out via better-auth (Google OAuth + email/password), with
  every `(app)` route guarded server-side.
- **Dashboard** — net worth, total coverage, upcoming 30-day outflows/inflows, and a
  "needs attention" list (overdue or due-within-7-days).
- **Timeline** — every `FinancialEvent`, filterable by month/quarter/year and by
  inflow/outflow.
- **Properties** — list view with tenant and next-due-bill info per property.
- **Utilities** (per property) — active utility templates with their recipients
  (add/remove who gets notified), a flat history of every generated bill with
  "mark paid", and "Add utility" to create a new template. No manual bill creation
  or utility editing — only deactivation.
- **Insurance** — policies with next premium due.
- **Investments & Loans** — holdings with gain/loss, loans with next EMI due.
- **Documents** — lists any `Document` rows (no upload flow yet).
- **Settings** — UI only; the toggles aren't wired to real preferences yet.

## What's next

- The background job that generates `UtilityBill` rows (the generation logic
  already exists as `generateUtilityBill` in `src/server/actions/utilities.ts` and
  `advanceByRecurrence` in `src/lib/recurrence.ts` — nothing calls them yet).
- Wiring up `NotificationRule`/`NotificationJob` to actually send reminders.
- Add/edit flows for Properties, Policies, Investments and Loans (currently
  "Coming soon" in the UI).
- Document upload.
- Surfacing `Currency` and `PaymentTransaction` in the UI; real Settings.

## Testing

```bash
pnpm test        # run once
pnpm test:watch  # watch mode
```

Jest + Testing Library, with the Prisma client mocked via `jest-mock-extended`
(`src/server/__mocks__/db.ts`) — no test touches the real database. Covers the
query layer, server actions, and every sync/client component.
