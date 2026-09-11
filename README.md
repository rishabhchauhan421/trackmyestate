# Asset Hub

A personal asset & reminder hub — track properties, insurance policies, investments
and loans, with every payment date and expected return flowing into one timeline.

Stack: Next.js 15 (App Router) · TypeScript · Prisma · PostgreSQL. Auth is
email/password with a signed httpOnly-cookie session (jose), no external auth service.

## Data model in one breath

- `User` owns many `Asset` rows. `Asset` is a supertype; each concrete kind
  (`Property`, `InsurancePolicy`, `Investment`, `Loan`) 1:1-extends it via `assetId`.
- `RecurringSchedule` is the single mechanism for premiums, EMIs, rent and recurring
  bills — they were all the same shape, so they share one table.
- `FinancialEvent` is the spine: every dated inflow/outflow. The timeline is a query
  over it; reminders derive from it plus asset key-dates (e.g. policy renewal).
- Money is `Decimal(14,2)` (exact NUMERIC), never a float.

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env and fill in values:
   ```bash
   cp .env.example .env
   # set DATABASE_URL to your Postgres, and generate AUTH_SECRET:
   #   openssl rand -base64 32
   ```
3. Create the tables:
   ```bash
   npx prisma db push
   ```
4. (Optional) Seed demo data — login demo@assethub.test / demopass123:
   ```bash
   npx tsx prisma/seed.ts
   ```
5. Run:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 — you'll be sent to /login. Register, and you're in.

## What's built

- Register / sign in / sign out, with protected routes via middleware.
- Dashboard (asset counts + upcoming events).
- Properties: list + add (the CRUD template for the other modules).
- Timeline: reads the FinancialEvent spine.
- Policies / Investments / Loans: stubbed — they follow the Properties pattern exactly.

## What's next

- Build the Policies / Investments / Loans add-forms (copy Properties).
- Add the `RecurringSchedule` -> `FinancialEvent` generator (a scheduled job that
  materialises the next N months of premiums, EMIs and rent).
- Build the reminder worker (scan upcoming events + key-dates, dispatch email/push/WhatsApp).
- Rooms, tenants and leases under a property.
