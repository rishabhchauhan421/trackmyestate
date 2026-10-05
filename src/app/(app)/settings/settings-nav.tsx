"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BellIcon, UsersIcon } from "~/app/_components/icons";

function ProfileIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function ChatIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
    </svg>
  );
}

const TABS = [
  { label: "General", href: "/settings", Icon: ProfileIcon },
  { label: "Reminders", href: "/settings/reminders", Icon: BellIcon },
  { label: "Channels", href: "/settings/channels", Icon: ChatIcon },
  { label: "Guests", href: "/settings/guests", Icon: UsersIcon },
];

/** Settings sub-navigation: a column on desktop, a scrolling row on phones. */
export function SettingsNav({ guestCount }: { guestCount: number }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings"
      className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:w-58 lg:shrink-0 lg:flex-col lg:overflow-visible lg:px-0"
    >
      {TABS.map(({ label, href, Icon }) => {
        const current =
          href === "/settings"
            ? pathname === "/settings"
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={clsx(
              "flex h-11 shrink-0 items-center gap-3 rounded-control px-3 text-sm whitespace-nowrap transition-colors",
              current
                ? "bg-surface font-semibold text-ink shadow-[0_0_0_1px_var(--color-line),inset_3px_0_0_var(--color-accent)]"
                : "font-medium text-ink-2 hover:bg-sunken-2 hover:text-ink",
            )}
          >
            <Icon
              className={clsx("size-5", current ? "text-accent" : "text-muted")}
            />
            {label}
            {label === "Guests" && guestCount > 0 && (
              <span className="ml-auto pl-2 text-xs font-semibold text-muted">
                {guestCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
