"use client";

import * as Headless from "@headlessui/react";
import {
  ArrowRightStartOnRectangleIcon,
  ChevronUpIcon,
  Cog8ToothIcon,
} from "@heroicons/react/16/solid";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Avatar } from "~/app/_components/avatar";
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
  name,
  email,
}: {
  anchor: "top start" | "bottom end";
  name: string;
  email?: string;
}) {
  return (
    <DropdownMenu className="min-w-64" anchor={anchor}>
      <DropdownHeader>
        <p className="truncate text-sm font-semibold text-ink">{name}</p>
        {email && <p className="truncate text-xs text-muted">{email}</p>}
      </DropdownHeader>
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

export function AppShell({
  name,
  email,
  initial,
  isAdmin = false,
  children,
}: {
  name: string;
  email?: string;
  initial: string;
  isAdmin?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

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
                <Avatar
                  initials={initial}
                  className="bg-night-3 text-white"
                  square
                />
              </DropdownButton>
              <AccountMenu anchor="bottom end" name={name} email={email} />
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
            {navGroups.map((group) => (
              <SidebarSection key={group}>
                <SidebarHeading>{group}</SidebarHeading>
                {navItems
                  .filter((item) => item.group === group)
                  .map(({ label, href, Icon }) => (
                    <SidebarItem
                      key={href}
                      href={href}
                      current={isActive(pathname, href)}
                    >
                      <Icon data-slot="icon" />
                      <SidebarLabel>{label}</SidebarLabel>
                    </SidebarItem>
                  ))}
              </SidebarSection>
            ))}

            {isAdmin && (
              <SidebarSection>
                <SidebarHeading>Admin</SidebarHeading>
                {adminNavItems.map(({ label, href, Icon }) => (
                  <SidebarItem
                    key={href}
                    href={href}
                    // "/admin" would otherwise also match "/admin/users" etc.
                    // under the shared prefix rule `isActive` uses elsewhere.
                    current={
                      href === "/admin"
                        ? pathname === "/admin"
                        : isActive(pathname, href)
                    }
                  >
                    <Icon data-slot="icon" />
                    <SidebarLabel>{label}</SidebarLabel>
                  </SidebarItem>
                ))}
              </SidebarSection>
            )}
          </SidebarBody>

          <SidebarFooter>
            <Dropdown>
              <DropdownButton as={SidebarItem}>
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar
                    initials={initial}
                    className="size-9 bg-night-3 text-white"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm/5 font-semibold text-white">
                      {name}
                    </span>
                    {email && (
                      <span className="block truncate text-xs/5 font-normal text-night-muted">
                        {email}
                      </span>
                    )}
                  </span>
                </span>
                <ChevronUpIcon data-slot="icon" />
              </DropdownButton>
              <AccountMenu anchor="top start" name={name} email={email} />
            </Dropdown>
          </SidebarFooter>
        </Sidebar>
      }
    >
      {children}
    </SidebarLayout>
  );
}
