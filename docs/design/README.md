# TrackMyEstate design system

The source of truth for how the app looks. Read this before building or
changing any UI. Code already follows it: when this file and a page disagree,
fix the page.

- **Visual reference:** the Claude Design canvas "TrackMyEstate Redesign"
  (<https://claude.ai/artifact/G9Y8VkA5NoSGewfDnHi9Be>, private to the
  project owner). Its artboards are copied into [`canvas/`](canvas/) as HTML
  so they can be read without access to it — see [Reference
  screens](#reference-screens).
- **Tokens:** [`src/styles/globals.css`](../../src/styles/globals.css).
- **Components:** [`src/app/_components/`](../../src/app/_components/).

## The look, in one paragraph

Calm and ledger-like. A warm off-white page, deep green-black ink, and a single
teal-green accent for primary actions, links and positive money. Amber and red
appear only for "due soon" and "overdue". A dark sidebar frames the app. Big
numbers and headings use Bricolage Grotesque; everything else uses Geist. Every
screen sits on the same width-capped column, card style and spacing scale.

## Rules

1. **Use tokens, never raw palette colors.** Write `text-muted`, `bg-surface`,
   `border-line`, `bg-accent`, not `text-slate-500`, `bg-white`, `bg-blue-600`.
   Tokens switch for dark mode by themselves, so don't add `dark:` color
   variants.
2. **Use the shared components** listed below before writing markup. A new
   page should be mostly `PageHeader`, `Card`, `StatCard`, `Button` and the
   form helpers.
3. **One primary action per view.** A filled `Button`; everything else is
   `variant="outline"` or a text link.
4. **Money:** format with `formatINR` from `~/lib/format`. Incoming amounts
   get a `+` and `text-accent`. Amounts are right-aligned in lists and tables;
   the body already sets tabular figures.
5. **Dates:** `formatDate` ("5 Oct 2026") in tables, `formatShortDate`
   ("5 Oct") in compact lists, `formatDueIn` ("Overdue 3 days", "Due today",
   "In 5 days") for anything with a deadline.
6. **Status color has meaning:** `danger` = overdue or lapsed, `warn` = due
   within 7 days, `ok` = paid or active, `accent` = incoming money. Always
   pair color with text (a label or badge), never color alone.
7. **Icons** come from `~/app/_components/icons` (outline, `stroke="currentColor"`).
   Color them with `text-*`, never `fill-*` — filling an outline icon turns it
   into a solid blob.
8. **Accessibility:** real `<button>`/`<a>`, every input inside a labelling
   `<label>` (use `Field`), `aria-label` on icon-only buttons, touch targets
   at least 44px (`Button` size `md` is 44px), visible focus (global
   `:focus-visible` ring — don't remove outlines).
9. **Phone width works:** grids collapse to one column (`grid-cols-1` first,
   then `sm:`/`lg:`), tables sit in `overflow-x-auto`, action rows `flex-wrap`.

## Tokens

Defined as CSS variables in `globals.css` and exposed as Tailwind colors.

| Token                                      | Use                                                                 | Light                             |
| ------------------------------------------ | ------------------------------------------------------------------- | --------------------------------- |
| `ground`                                   | Page background                                                     | `#f5f6f2`                         |
| `surface`                                  | Cards, inputs, menus                                                | `#ffffff`                         |
| `sunken` / `sunken-2`                      | Inset areas, table headers, tab track, hover                        | `#f5f6f2` / `#e9ece7`             |
| `ink`                                      | Primary text, headings                                              | `#12201c`                         |
| `ink-2`                                    | Secondary body text                                                 | `#3e4b46`                         |
| `muted`                                    | Labels, hints, meta text                                            | `#5a6762`                         |
| `line` / `line-soft` / `line-strong`       | Card borders / dividers / input borders                             | `#e3e7e2` / `#eef1ed` / `#cbd3cd` |
| `accent` / `accent-strong` / `accent-soft` | Primary actions, links, incoming money / hover / tinted backgrounds | `#0f6e5d` / `#0a5446` / `#e3f1ec` |
| `on-accent`                                | Text on `bg-accent`                                                 | `#ffffff`                         |
| `mint`                                     | Highlights on dark surfaces                                         | `#5fd0b4`                         |
| `night`, `night-2`, `night-3`              | Always-dark surfaces: sidebar, hero/feature panels                  | `#10201c`, `#182c27`, `#21413a`   |
| `night-ink` / `night-muted`                | Text on night surfaces                                              | `#c3cfca` / `#8ea19a`             |
| `danger` / `danger-soft`                   | Overdue, errors, destructive                                        | `#b42318` / `#fdecea`             |
| `warn` / `warn-soft`                       | Due soon                                                            | `#8a4b0b` / `#fdf1dc`             |
| `ok` / `ok-soft`                           | Paid, active, success                                               | `#116b4a` / `#e2f3ea`             |

Radii: `rounded-control` (10px) for buttons and inputs, `rounded-card` (16px)
for cards, `rounded-full` for badges and chips.

## Typography

| Role                | Classes                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| Page title          | `font-display text-[2rem] font-semibold tracking-[-0.02em] text-ink` (rendered by `PageHeader`) |
| Big figure          | `font-display text-[1.75rem] font-semibold` (rendered by `StatCard`)                            |
| Card title          | `text-base font-semibold text-ink` (rendered by `CardHeader`)                                   |
| Body                | `text-sm`/`text-[0.9375rem] text-ink` or `text-ink-2`                                           |
| Meta / hint         | `text-[0.8125rem]` or `text-xs`, `text-muted`                                                   |
| Eyebrow (marketing) | `text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-accent`                        |

Fonts: `font-display` = Bricolage Grotesque (headings, figures),
`font-sans` = Geist (default). Never Inter, Roboto or Arial.

## Layout

- The app shell (`AppShell` → `SidebarLayout`) gives every signed-in page a
  264px dark sidebar and a content column capped at `max-w-300` (1200px) with
  `space-y-7` between sections. Don't add another page-level wrapper.
- Card grids: `grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4` for
  stats; `md:grid-cols-2 xl:grid-cols-3` for item cards; main + aside is
  `grid-cols-1 lg:grid-cols-3` with the main column `lg:col-span-2`.
- Spacing scale inside cards: `px-5 py-4 sm:px-6` for rows, `p-5 sm:p-6` for
  padded cards, `gap-4` between cards.

## Components

All in `src/app/_components/`.

| Component                                | Use it for                                                                                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PageHeader`                             | Top of every app page: `title`, `description`, `action` (buttons), `breadcrumbs`.                                                                          |
| `Breadcrumbs`, `propertyCrumbs()`        | Full trail from the section down: `[...propertyCrumbs(property, "Leases"), { label: "Edit lease" }]`. Last item = current page.                            |
| `Card`, `CardHeader`                     | Every white panel; header row with title + optional link.                                                                                                  |
| `StatCard`                               | Headline figure with label and hint. `tone="dark"` for the one emphasised stat in a row.                                                                   |
| `Button`                                 | All buttons and button-styled links (`href`). `variant` solid/outline, `color` (`blue` = primary accent, `slate` = dark, `red`, `white`), `size` sm/md/lg. |
| `Field`, `Input`, `Select`, `MoneyInput` | Labelled form controls. `optional` adds "· optional". `MoneyInput` adds the ₹ prefix.                                                                      |
| `FormSection`, `FormActions`             | Group fields into titled cards; right-aligned Cancel (outline) + Save (primary) row.                                                                       |
| `ChoiceCards`                            | A short set of exclusive options shown as large radio cards (e.g. property type).                                                                          |
| `Notice`                                 | Inline success/error message above a form.                                                                                                                 |
| `Breadcrumbs`                            | The trail alone, where a page builds its own header (e.g. property detail).                                                                                |
| `StatusBadge`                            | Bill/policy status chips (PAID, DUE, OVERDUE, ACTIVE, LAPSED, …).                                                                                          |
| `EmptyState`                             | A list with nothing in it yet, with one call to action.                                                                                                    |
| `Dropdown*`                              | Menus (e.g. "Manage", "Add asset").                                                                                                                        |
| `SlimLayout`                             | Auth pages: form column + dark brand panel.                                                                                                                |
| `Logo`                                   | The mark + wordmark.                                                                                                                                       |

## Page recipes

- **List page:** `PageHeader` (primary "Add …" button) → optional totals bar →
  filter tabs (links with `?type=`) → card grid → `EmptyState` when empty.
  See `src/app/(app)/properties/page.tsx`.
- **Detail page:** breadcrumbs + title with icon and type chip + actions →
  `StatCard` row → section tabs → main column cards + details aside.
  See `src/app/(app)/properties/[id]/page.tsx`.
- **Form page:** `PageHeader` with breadcrumbs → `form` of `FormSection`s →
  `FormActions`; optional aside for tips or the delete zone.
  See `src/app/(app)/properties/new/page.tsx` and `_components/property-form-fields.tsx`.
- **Dashboard:** see `src/app/(app)/dashboard/page.tsx`.

## Reference screens

[`canvas/`](canvas/) holds the Claude Design artboards as self-contained HTML
with inline styles. Read them for exact layout, copy and spacing; don't import
or copy their markup — rebuild with the tokens and components above (the
artboards use raw hex values that map to the tokens in the table).

| Artboard                          | Implemented in                                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `Main.dc.html` (dashboard)        | `src/app/(app)/dashboard/page.tsx`                                                                                   |
| `AppSidebar.dc.html`              | `src/app/_components/app-shell.tsx`, `sidebar.tsx`                                                                   |
| `Properties.dc.html`              | `src/app/(app)/properties/page.tsx`                                                                                  |
| `PropertyDetail.dc.html`          | `src/app/(app)/properties/[id]/page.tsx`                                                                             |
| `AddProperty.dc.html`             | `src/app/(app)/properties/new/page.tsx`                                                                              |
| `Landing.dc.html`                 | `src/app/page.tsx`                                                                                                   |
| `SignIn.dc.html`                  | `src/app/(auth)/login/page.tsx` (also forgot/reset password)                                                         |
| `SettingsNav.dc.html`             | `src/app/(app)/settings/settings-nav.tsx`, `settings/layout.tsx`                                                     |
| `SettingsGeneral.dc.html`         | `src/app/(app)/settings/page.tsx`                                                                                    |
| `SettingsReminders.dc.html`       | `src/app/(app)/settings/reminders/page.tsx`                                                                          |
| `SettingsChannels.dc.html`        | `src/app/(app)/settings/channels/page.tsx` — SMS/WhatsApp verification, quiet hours and digest show as "coming soon" |
| `SettingsGuests.dc.html`          | `src/app/(app)/settings/guests/page.tsx`                                                                             |
| `AddGuest.dc.html`                | `src/app/(app)/settings/guests/new/page.tsx` (a page rather than a dialog; same form edits a guest)                  |
| `AdminOverview.dc.html`           | `src/app/(app)/admin/page.tsx`                                                                                       |
| `AdminUsers.dc.html`              | `src/app/(app)/admin/users/page.tsx`                                                                                 |
| `AdminNotifications.dc.html`      | `src/app/(app)/admin/notifications/page.tsx`                                                                         |
| `AdminNotificationDetail.dc.html` | `src/app/(app)/admin/notifications/[id]/page.tsx`                                                                    |

The canvas has three pages — **App & marketing**, **Settings** and **Admin**.
The sidebar's Admin section only shows on the admin artboards (or with the
sidebar's `admin` tweak), matching `isAdmin` in `app-shell.tsx`.

Sample names and amounts in the artboards come from `prisma/seed.ts`; they're
illustrative, not product copy.

## Updating the design

1. Change the canvas in Claude Design (or ask an agent with access to do it).
2. Re-export the changed artboards into `docs/design/canvas/`.
3. Update tokens in `globals.css` and the tables in this file in the same
   change, then the components.
