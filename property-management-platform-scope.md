# Personal Asset & Reminder Hub — Scope Document

**Version:** 2.0 (Reframed)
**Date:** 11 September 2026
**Status:** For review
**Previous title:** Property Management Platform

---

## 1. What this is

A consumer app for people with a lot going on — several properties, many insurance and mediclaim policies, and a spread of investments and loans — who can no longer keep track of it all. The app brings every asset into one place and, above all, **makes sure they never miss a date**: a premium, a renewal, an EMI, a rent collection, a policy maturity, an expected return.

The job it does, in one line: **aggregate everything, and never let me miss a date.**

This is not a landlord SaaS. The user is the *owner* tracking their own portfolio. Tenants, insurers and lenders are records the user manages — they do not log in.

---

## 2. Who it's for

Urban, asset-rich, time-poor individuals and families:

- Own multiple properties (self-occupied, rented, under construction, investments).
- Hold many policies — life, health/mediclaim, vehicle, home.
- Have scattered investments (FDs, mutual funds/SIPs, stocks, gold) and loans/EMIs.
- Are busy professionals who lose track of due dates and paperwork, and pay for it in lapsed policies, missed EMIs, and forgotten renewals.

They don't want a spreadsheet. They want peace of mind and timely nudges.

---

## 3. The core promise (and what the whole app is built around)

Three things *are* the product. Everything else is detail that feeds them:

1. **Fast onboarding** — getting a messy, sizeable portfolio into the app with minimal typing.
2. **A smart reminder engine** — the right nudge, early enough, on the right channel.
3. **One unified timeline** — a single view of every rupee going out and coming in, with dates.

If these three are excellent, the app succeeds even if individual modules are thin. If these three are weak, no amount of module depth saves it.

---

## 4. Goals & success metrics

- **Activation:** a new user gets their first ~5 assets in and sees their first timeline within one session. Track *time-to-first-5-assets*.
- **Retention driver:** users act on reminders (open rate, and % of due items marked done on time).
- **Value proof:** reduction in lapsed policies / missed EMIs / forgotten renewals (self-reported or inferred).
- **Coverage:** average number of assets tracked per active user (the more, the stickier).

---

## 5. Product principles

- **Onboarding is the product's hardest problem, not a setup screen.** Optimize relentlessly for getting data in.
- **The timeline is the home screen.** Not a report buried in a menu.
- **Reminders must be smart, not naggy.** Configurable, escalating, multi-channel.
- **Trust is a feature.** People are handing over their whole financial life; security and privacy must be visible and reassuring.
- **Every asset reduces to dated money-in / money-out + key dates.** Build that shared spine once.

---

## 6. Functional Scope

### 6.1 Fast onboarding & data ingestion *(Core — highest priority)*

The target user will not hand-type dozens of assets. If setup is tedious, they leave before seeing value. So this is where the most effort goes.

- **Document upload + parsing/OCR:** drop a policy PDF, loan statement, or property paper; the app extracts what it can and pre-fills the record for confirmation.
- **Email ingestion:** a forwarding address (e.g. forward insurer/renewal emails) that auto-creates or updates records.
- **Account Aggregator (India):** explore RBI's AA framework to pull financial data (bank deposits, mutual funds, insurance, pensions) with user consent, removing manual entry for supported asset types. *(Verify current coverage and licensing before committing — see §9.)*
- **Quick stubs:** let users create a bare record (name + one date) in seconds and enrich it later. Never block on completeness.
- **Sensible defaults & templates** per asset type to minimise fields shown up front.

### 6.2 Reminder engine *(Core)*

The retention engine. A dumb "due tomorrow" ping is not enough for this audience.

- Configurable **lead time** per reminder type (e.g. remind 30 days before a policy renewal, 3 days before an EMI).
- **Escalation:** repeated nudges as a deadline nears (e.g. 30 / 7 / 1 days), with harder emphasis for hard deadlines like policy lapse.
- **Multi-channel:** push + email + WhatsApp (WhatsApp matters in India). User picks channels per reminder type.
- **Weekly digest:** "here's everything happening this month" — outflows due and inflows expected.
- **Snooze / mark done / mark paid** directly from the notification.
- Auto-generated from asset data (premiums, EMIs, renewals, rent, maturities) so users don't set reminders manually.

### 6.3 Unified financial timeline *(Core — the hero view)*

The single screen that justifies the app.

- Every **inflow and outflow** in one dated view: rent, utility bills, insurance premiums, policy maturities/payouts, EMIs, expected investment returns.
- Answers instantly: *what do I pay this month, and what money is coming back to me and when.*
- Toggle **month / quarter / year**; filter by asset, by property, or by inflow vs. outflow.
- Running view of upcoming net cash flow.
- Export to CSV/PDF.

### 6.4 Authentication & account *(Foundation)*

Plumbing, not value — keep it standard and frictionless.

- Register (email/password + verification), sign in, sign out, password reset, profile edit.
- Google / social sign-in to reduce onboarding friction.
- Two-factor auth (given the sensitivity of stored data — strongly recommended, not optional long-term).
- Biometric unlock on mobile.

### 6.5 Asset module — Property

- Add a property: name, address, type (self-occupied / rented / under-construction / investment), photos, documents.
- Optional rooms/units for multi-unit properties, with occupancy status.
- Tenants as **records** (name, contact, lease terms, rent, deposit) — no tenant login.
- Rent tracking: expected vs. received, due day, status (due/paid/overdue) → feeds timeline + reminders.
- Utility/other bills (electricity, water, tax, maintenance): amount, due date, paid/unpaid → feeds timeline + reminders.
- Linked loan/EMI and insurance surfaced on the property view (a property drags its whole paper trail with it).

### 6.6 Asset module — Insurance & policies

- Policy types: life (term/endowment/money-back/ULIP), **health/mediclaim**, vehicle, home. Configurable list.
- Fields: insurer, policy number, holder, nominee(s), start date, tenure, status; sum assured/coverage; for mediclaim — room-rent limit, co-pay, waiting period, network hospitals.
- **Premium schedule:** amount, frequency, next due, grace period → outflows + reminders (renewal lapse is a hard deadline).
- **Returns / maturity:** maturity value & date; money-back milestone payouts (date + amount each); bonuses → inflows on the timeline.
- **Claims** (mediclaim/general): filed → approved → settled, amounts, documents.

### 6.7 Asset module — Investments & loans/EMIs

- **Investments:** asset name, type (property / FD / RD / mutual fund / stocks / gold / business), date, cost; capital deployed incl. property down payment; expected return type, expected return/exit date, target ROI; actual returns logged; current estimated value.
- **Loans & EMIs:** lender, loan type, principal, rate, tenure; EMI amount + due day; auto **amortization schedule** (principal/interest split); prepayment handling; outstanding balance. Link a loan to the asset it financed → EMIs feed the timeline + reminders.

### 6.8 Document vault

- Store policy PDFs, loan statements, property papers, receipts, KYC, claim documents — attached to any asset.
- Retrieve by asset, type, or date. Encrypted at rest (see §8).

### 6.9 Dashboard

- Net worth snapshot (assets − liabilities), total coverage, upcoming outflows, expected inflows, items needing attention (lapsing soon, overdue).
- Entry point to the timeline and to each asset module.

---

## 7. High-Level Data Model

The spine is a single **financial event** record. Every module just emits these.

- **User** → owns many **Assets**.
- **Asset** (abstract) → specialised as **Property**, **Policy**, **Investment**. Common: name, type, dates, documents.
- **Property** → optional **Rooms**, optional **Tenant** records, **Rent** records, **Bills**.
- **Policy** → **Premium schedule** (outflows), **Payout/Maturity** entries (inflows), **Claims**.
- **Investment** → capital deployed, expected & actual **Returns** (inflows).
- **Loan** → optionally linked to an Asset; **EMI schedule** (outflows) + amortization.
- **Financial event** *(unifying record)* → a dated inflow or outflow emitted by any of the above; powers the timeline, dashboard, and reminders.
- **Reminder** → generated from financial events + renewal/expiry dates; has channel, lead time, escalation, status.
- **Document** → attachment linked to any asset or event.

Designing the *financial event* and *reminder* as generic records from day one is what makes the timeline and reminder engine cheap rather than a rebuild.

---

## 8. Non-Functional Requirements

- **Security (visible, not just present):** hashed passwords, 2FA, encryption at rest for documents and sensitive fields, per-user data isolation, full access/audit log. Communicate this clearly in-product.
- **Privacy:** clear consent, retention, and deletion controls; user can export or delete everything.
- **Responsive + mobile-first:** reminders and quick check-ins happen on the phone.
- **Reliability of reminders:** the notification pipeline is mission-critical — a missed reminder is a broken promise. Build for delivery guarantees and retries.
- **Performance:** dashboard and timeline stay fast with hundreds of assets/events.
- **Backups:** automated, tested.

---

## 9. Compliance (India)

- **DPDP Act:** you're storing health (mediclaim), financial and KYC data — high-sensitivity. Confirm obligations for consent, storage, and breach handling before build.
- **Account Aggregator framework:** confirm which asset types are covered today and what licensing/partnership is required before designing onboarding around it.
- **Rent receipts / GST / TDS** where the property module touches money — confirm formats with an accountant, as rules change.

*(These shift over time — verify current rules rather than relying on this note.)*

---

## 10. Out of Scope

- **Tenant self-service logins** — cut. Users own the assets; tenants are records.
- **Online rent collection / payment gateway** — cut for now. Removes major complexity and compliance load. Revisit only if users ask.
- Accounting/tax-filing integrations.
- Multi-currency / multi-language (design fields to allow it later).
- Native desktop app (responsive web + mobile).

---

## 11. Suggested Phasing

The MVP is a **thin slice that proves the core thesis**: one ledger + reminders across asset types.

| Phase | Focus |
|-------|-------|
| **Phase 1 (MVP)** | Auth · add a property, a policy, an investment/loan via **quick manual entry + document upload** · auto-generated **reminders** (email + push) · the **unified timeline** · basic dashboard |
| **Phase 2** | OCR/parsing & email ingestion · WhatsApp reminders + weekly digest · full property detail (rooms, tenants, rent, bills) · claims tracking · document vault |
| **Phase 3** | Account Aggregator auto-sync · net-worth analytics · advanced timeline (forecasting) · sharing with family/advisor |

Deliberately, reminders and the timeline are in the MVP; the deep module detail and the fancy ingestion are later. The value has to be visible in Phase 1.

---

## 12. Open Questions

1. **Wedge vs. breadth:** launch as "track your whole life," or lead with **property + everything attached to it** (loan, insurance, tax, rent) and expand outward? Narrow is easier to build, sell, and be best at.
2. **Onboarding bet:** how much of Phase 1 rides on document OCR vs. plain manual entry? OCR is high-value but high-effort — is it MVP or Phase 2?
3. **Account Aggregator:** worth building around, or treat as a Phase 3 accelerator once traction exists?
4. **Reminder channels for MVP:** is WhatsApp essential from day one, or do email + push suffice to launch?
5. **Family/household:** one user per portfolio, or shared access (spouse, advisor)? Affects auth and data model early.
6. **Free vs. paid:** what's the monetisation thesis — subscription, freemium by asset count, advisor upsell? Shapes limits in the data model.

---

## 13. Positioning note

The strongest wedge is likely **property owners**: a property already drags a loan, insurance, tax, utilities and (if rented) rent into one tangled bundle — so it's the user with the most acute tracking pain and the richest starting dataset. Win that user with "everything about your property, in one place, never miss a date," then expand naturally into their standalone policies and investments. "Track everything" is the vision; "untangle your property" may be the doorway.
