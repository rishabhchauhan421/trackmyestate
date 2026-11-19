"use client";

import * as Headless from "@headlessui/react";
import {
  ArrowRightStartOnRectangleIcon,
  ChevronUpIcon,
  Cog8ToothIcon,
} from "@heroicons/react/16/solid";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownHeader,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  dropdownItemClassName,
} from "~/app/_components/dropdown";
import {
  InsuranceIcon,
  InvestmentsIcon,
  LoansIcon,
  PlusIcon,
  PropertiesIcon,
} from "~/app/_components/icons";
import {
  adminNavItems,
  isActive,
  navGroups,
  navItems,
} from "~/app/_components/nav";
import {
  Navbar,
  NavbarItem,
  NavbarSection,
  NavbarSpacer,
} from "~/app/_components/navbar";
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarHeading,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
} from "~/app/_components/sidebar";
import { Logo } from "~/app/_components/logo";
import { SidebarLayout } from "~/app/_components/sidebar-layout";
import { signOut } from "~/server/actions/sign-out";

/** One entry per asset type the "Add asset" menu can create. */
const addAssetItems = [
  { label: "Property", href: "/properties/new", Icon: PropertiesIcon },
  { label: "Insurance policy", href: "/insurance/new", Icon: InsuranceIcon },
  { label: "Investment", href: "/investments/new", Icon: InvestmentsIcon },
  { label: "Loan", href: "/loans/new", Icon: LoansIcon },
];

function AccountMenu({
  anchor,
  heading,
}: {
  anchor: "top start" | "bottom end";
  /** The user's name and email. */
  heading: React.ReactNode;
}) {
  return (
    <DropdownMenu className="min-w-64" anchor={anchor}>
      <DropdownHeader>{heading}</DropdownHeader>
      <DropdownDivider />
      <DropdownItem href="/settings">
        <Cog8ToothIcon />
        <DropdownLabel>Settings</DropdownLabel>
      </DropdownItem>
      <DropdownDivider />
      <form action={signOut} data-gtm-event="sign_out" className="contents">
        <Headless.CloseButton
          as="button"
          type="submit"
          className={dropdownItemClassName("w-full")}
        >
          <ArrowRightStartOnRectangleIcon />
          <DropdownLabel>Sign out</DropdownLabel>
        </Headless.CloseButton>
      </form>
    </DropdownMenu>
  );
}

/** The sidebar's main links, with the one for `pathname` marked current. */
function MainNav({ pathname }: { pathname: string | null }) {
  return navGroups.map((group) => (
    <SidebarSection key={group}>
      <SidebarHeading>{group}</SidebarHeading>
      {navItems
        .filter((item) => item.group === group)
        .map(({ label, href, Icon }) => (
          <SidebarItem
            key={href}
            href={href}
            current={pathname !== null && isActive(pathname, href)}
          >
            <Icon data-slot="icon" />
            <SidebarLabel>{label}</SidebarLabel>
          </SidebarItem>
        ))}
    </SidebarSection>
  ));
}

/**
 * `MainNav` for the current route. Reading the route needs a `<Suspense>`
 * boundary: on a page whose address has a dynamic part it isn't known
 * while the frame is prerendered, so the links appear unmarked first.
 */
function MainNavOnRoute() {
  return <MainNav pathname={usePathname()} />;
}

/** The sidebar's Admin section. The layout renders it for admins only. */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <SidebarSection>
      <SidebarHeading>Admin</SidebarHeading>
      {adminNavItems.map(({ label, href, Icon }) => (
        <SidebarItem
          key={href}
          href={href}
          // "/admin" would otherwise also match "/admin/users" etc.
          // under the shared prefix rule `isActive` uses elsewhere.
          current={
            href === "/admin" ? pathname === "/admin" : isActive(pathname, href)
          }
        >
          <Icon data-slot="icon" />
          <SidebarLabel>{label}</SidebarLabel>
        </SidebarItem>
      ))}
    </SidebarSection>
  );
}

function AddAssetMenu() {
  return (
    <Dropdown>
      <DropdownButton
        as="button"
        className="flex h-11 w-full items-center justify-center gap-2 rounded-control bg-mint text-sm font-semibold text-night transition-colors hover:bg-[#7ddcc4]"
      >
        <PlusIcon className="size-4.5" />
        Add asset
      </DropdownButton>
      <DropdownMenu anchor="bottom start" className="min-w-56">
        {addAssetItems.map(({ label, href, Icon }) => (
          <DropdownItem key={href} href={href}>
            <Icon data-slot="icon" />
            <DropdownLabel>{label}</DropdownLabel>
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}

/**
 * The signed-in frame: sidebar, mobile navbar and the page beside them.
 * Everything that names the user arrives as a slot from
 * `(app)/layout.tsx`, so this frame itself reads nothing from the request
 * and can be prerendered.
 */
export function AppShell({
  navbarAvatar,
  sidebarAvatar,
  accountHeading,
  accountSummary,
  adminNav,
  children,
}: {
  /** The user's avatar, at the mobile navbar's size. */
  navbarAvatar: React.ReactNode;
  /** The user's avatar, at the sidebar footer's size. */
  sidebarAvatar: React.ReactNode;
  /** Name and email for the account menu's heading. */
  accountHeading: React.ReactNode;
  /** Name and email for the sidebar's footer. */
  accountSummary: React.ReactNode;
  /** `<AdminNav />` for admins, nothing for everyone else. */
  adminNav: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SidebarLayout
      navbar={
        <Navbar>
          <Link href="/dashboard" className="text-ink">
            <Logo />
          </Link>
          <NavbarSpacer />
          <NavbarSection>
            <Dropdown>
              <DropdownButton as={NavbarItem} aria-label="Account menu">
                {navbarAvatar}
              </DropdownButton>
              <AccountMenu anchor="bottom end" heading={accountHeading} />
            </Dropdown>
          </NavbarSection>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <Link href="/dashboard" className="px-2 py-1 text-white">
              <Logo />
            </Link>
            <AddAssetMenu />
          </SidebarHeader>

          <SidebarBody>
            <Suspense fallback={<MainNav pathname={null} />}>
              <MainNavOnRoute />
            </Suspense>

            {adminNav}
          </SidebarBody>

          <SidebarFooter>
            <Dropdown>
              <DropdownButton as={SidebarItem}>
                <span className="flex min-w-0 items-center gap-3">
                  {sidebarAvatar}
                  <span className="min-w-0">{accountSummary}</span>
                </span>
                <ChevronUpIcon data-slot="icon" />
              </DropdownButton>
              <AccountMenu anchor="top start" heading={accountHeading} />
            </Dropdown>
          </SidebarFooter>
        </Sidebar>
      }
    >
      {children}
    </SidebarLayout>
  );
}
