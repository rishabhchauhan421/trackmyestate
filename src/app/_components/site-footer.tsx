import { NavLink } from "~/app/_components/nav-link";

const navItems = [
  { href: "#features", label: "Features" },
  { href: "#faq", label: "FAQ" },
];

/** The marketing homepage's own footer — logo, quick links, copyright. */
export function SiteFooter() {
  return (
    <footer className="border-t border-slate-100 bg-slate-50 dark:border-slate-900 dark:bg-slate-900/40">
      <div className="mx-auto max-w-6xl px-6 py-12 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-sm font-bold text-white">
            T
          </span>
          <span className="font-display text-sm font-semibold text-slate-900 dark:text-slate-50">
            TrackMyEstate
          </span>
        </div>
        <nav aria-label="quick links" className="mt-6">
          <div className="flex justify-center gap-x-6">
            {navItems.map((item) => (
              <NavLink key={item.href} href={item.href}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
        <p className="mt-8 text-xs text-slate-400 dark:text-slate-500">
          © {new Date().getFullYear()} TrackMyEstate — your whole financial
          life, tracked, dated and reminded.
        </p>
      </div>
    </footer>
  );
}
