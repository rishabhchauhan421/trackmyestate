import {
  DashboardIcon,
  DocumentsIcon,
  InsuranceIcon,
  InvestmentsIcon,
  PropertiesIcon,
  SettingsIcon,
  TimelineIcon,
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
    label: "Investments & Loans",
    href: "/investments",
    description: "FDs, mutual funds, stocks, EMIs and amortization",
    Icon: InvestmentsIcon,
  },
  {
    label: "Documents",
    href: "/documents",
    description: "Every policy, statement and paper, in one vault",
    Icon: DocumentsIcon,
  },
  {
    label: "Settings",
    href: "/settings",
    description: "Profile, security and notification channels",
    Icon: SettingsIcon,
  },
] as const;

export type NavItem = (typeof navItems)[number];
