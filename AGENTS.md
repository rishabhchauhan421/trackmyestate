<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Design system

All UI follows the TrackMyEstate design system. Before creating or changing any page or component, read [`docs/design/README.md`](docs/design/README.md) — it covers the tokens, typography, layout, shared components and page recipes. In short:

- Use the semantic color tokens from `src/styles/globals.css` (`text-ink`, `text-muted`, `bg-surface`, `border-line`, `bg-accent`, `text-danger`, …). Never raw Tailwind palette colors (`slate-*`, `blue-*`, `zinc-*`, …) and no `dark:` color variants — the tokens handle dark mode.
- Build from the shared components in `src/app/_components/` (`PageHeader` with `breadcrumbs`, `Card`, `StatCard`, `Button`, `Field`/`Input`/`Select`/`MoneyInput`, `FormSection`/`FormActions`, `StatusBadge`, `EmptyState`) instead of new markup.
- Reference screens from the Claude Design canvas are in [`docs/design/canvas/`](docs/design/canvas/) (the live canvas, private to the owner: https://claude.ai/artifact/G9Y8VkA5NoSGewfDnHi9Be).
