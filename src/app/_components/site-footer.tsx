import { Logo } from "~/app/_components/logo";

const navItems = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

/** The marketing homepage's own footer — logo, quick links, copyright. */
export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-300 flex-col gap-6 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="space-y-2 text-ink">
          <Logo />
          <p className="text-[0.8125rem] text-muted">
            © {new Date().getFullYear()} TrackMyEstate — your whole financial
            life, tracked, dated and reminded.
          </p>
        </div>
        <nav aria-label="Quick links" className="flex gap-6 text-[0.8125rem]">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="font-medium text-muted hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
