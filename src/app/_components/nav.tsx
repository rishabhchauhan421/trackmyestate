import {
  DashboardIcon,
  DocumentsIcon,
  InsuranceIcon,
  InvestmentsIcon,
  LoansIcon,
  PropertiesIcon,
  ShieldIcon,
  TimelineIcon,
  UsersIcon,
} from "~/app/_components/icons";

export const navItems = [
  {
    label: "Dashboard",
    group: "Overview",
    href: "/dashboard",
    description: "Net worth, coverage and what needs attention",
    Icon: DashboardIcon,
  },
  {
    label: "Timeline",
    group: "Overview",
    href: "/timeline",
    description: "Every inflow and outflow, in one dated view",
    Icon: TimelineIcon,
  },
  {
    label: "Properties",
    group: "Assets",
    href: "/properties",
    description: "Homes, rentals, tenants, rent and bills",
    Icon: PropertiesIcon,
  },
  {
    label: "Insurance",
    group: "Assets",
    href: "/insurance",
    description: "Life, health, vehicle and home policies",
    Icon: InsuranceIcon,
  },
  {
    label: "Investments",
    group: "Assets",
    href: "/investments",
    description: "FDs, mutual funds, stocks and gold",
    Icon: InvestmentsIcon,
  },
  {
    label: "Loans",
    group: "Assets",
    href: "/loans",
    description: "EMIs, amortization and outstanding balance",
    Icon: LoansIcon,
  },
  {
    label: "Documents",
    group: "Vault",
    href: "/documents",
    description: "Every policy, statement and paper, in one vault",
    Icon: DocumentsIcon,
  },
] as const;

export type NavItem = (typeof navItems)[number];

/** Sidebar section headings, in display order. */
export const navGroups = ["Overview", "Assets", "Vault"] as const;

/** Only rendered for admins — see `isAdmin` in `~/server/better-auth/server`. */
export const adminNavItems = [
  {
    label: "Overview",
    href: "/admin",
    description: "Platform-wide users, portfolio value and notification health",
    Icon: ShieldIcon,
  },
  {
    label: "Jobs",
    href: "/admin/jobs",
    description: "Bill generation, reminders and sending — run them now",
    Icon: TimelineIcon,
  },
  {
    label: "Users",
    href: "/admin/users",
    description: "Every signed-up user and their portfolio size",
    Icon: UsersIcon,
  },
] as const;

/** `pathname.startsWith(href + "/")`, not a bare prefix — without the
 * trailing slash, "/investments-old" would false-positive match "/investments". */
export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
