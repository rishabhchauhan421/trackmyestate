import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/**
 * One step of a breadcrumb trail. Every step but the last links to its
 * page; the last is the current page and is rendered as plain text.
 */
export type Crumb = { label: string; href?: string };

/**
 * The trail from the top-level section down to the current page, e.g.
 * Properties / Whitefield Flat / Leases / Edit lease.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-muted">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <Fragment key={`${index}-${item.label}`}>
              <li className="max-w-full truncate">
                {isLast || !item.href ? (
                  <span aria-current={isLast ? "page" : undefined}>
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href}
                    className="font-medium text-accent hover:text-accent-strong"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
              {!isLast && (
                <li aria-hidden="true" className="text-line-strong">
                  /
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * The title block at the top of every app page: an optional breadcrumb
 * trail, the page title and description, and the page's main actions on
 * the right.
 */
export function PageHeader({
  title,
  description,
  action,
  breadcrumbs,
}: {
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
  /** Section → … → this page; the last item is the current page. */
  breadcrumbs?: Crumb[];
}) {
  return (
    <header className="space-y-4">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs items={breadcrumbs} />
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl space-y-1.5">
          <h1 className="font-display text-[2rem] leading-tight font-semibold tracking-[-0.02em] text-ink">
            {title}
          </h1>
          <p className="text-[0.9375rem] leading-relaxed text-muted">
            {description}
          </p>
        </div>
        {action && <div className="flex flex-wrap gap-2.5">{action}</div>}
      </div>
    </header>
  );
}

/**
 * The shared start of every trail under one property:
 * Properties / {property name} [/ {section}].
 */
export function propertyCrumbs(
  property: { id: string; name: string },
  section?: "Leases" | "Rental units" | "Utilities",
): Crumb[] {
  const base = `/properties/${property.id}`;
  const crumbs: Crumb[] = [
    { label: "Properties", href: "/properties" },
    { label: property.name, href: base },
  ];
  if (section) {
    const path = {
      Leases: "leases",
      "Rental units": "rentals",
      Utilities: "utilities",
    }[section];
    crumbs.push({ label: section, href: `${base}/${path}` });
  }
  return crumbs;
}
