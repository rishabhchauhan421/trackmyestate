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
    href: "/dashboard",
    description: "Net worth, coverage and what needs attention",
    Icon: DashboardIcon,
  },
  {
    label: "Timeline",
    href: "/timeline",
    description: "Every inflow and outflow, in one dated view",
    Icon: TimelineIcon,
  },
  {
    label: "Properties",
    href: "/properties",
    description: "Homes, rentals, tenants, rent and bills",
    Icon: PropertiesIcon,
  },
  {
    label: "Insurance",
    href: "/insurance",
    description: "Life, health, vehicle and home policies",
    Icon: InsuranceIcon,
  },
  {
    label: "Investments",
    href: "/investments",
    description: "FDs, mutual funds, stocks and gold",
    Icon: InvestmentsIcon,
  },
  {
    label: "Loans",
    href: "/loans",
    description: "EMIs, amortization and outstanding balance",
    Icon: LoansIcon,
  },
  {
    label: "Documents",
    href: "/documents",
    description: "Every policy, statement and paper, in one vault",
    Icon: DocumentsIcon,
  },
] as const;

export type NavItem = (typeof navItems)[number];

/** Only rendered for admins — see `isAdmin` in `~/server/better-auth/server`. */
export const adminNavItems = [
  {
    label: "Overview",
    href: "/admin",
    description: "Platform-wide users, portfolio value and notification health",
    Icon: ShieldIcon,
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
