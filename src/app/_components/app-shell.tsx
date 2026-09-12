"use client";

import * as Headless from "@headlessui/react";
import {
  ArrowRightStartOnRectangleIcon,
  ChevronUpIcon,
  Cog8ToothIcon,
} from "@heroicons/react/16/solid";
import { usePathname } from "next/navigation";

import { Avatar } from "~/app/_components/avatar";
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
  dropdownItemClassName,
} from "~/app/_components/dropdown";
import { adminNavItems, isActive, navItems } from "~/app/_components/nav";
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
  SidebarSpacer,
} from "~/app/_components/sidebar";
import { SidebarLayout } from "~/app/_components/sidebar-layout";
import { signOut } from "~/server/actions/sign-out";

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
        <p className="truncate text-sm font-medium text-zinc-950 dark:text-white">
          {name}
        </p>
        {email && (
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            {email}
          </p>
        )}
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

function DropdownHeader({ children }: { children: React.ReactNode }) {
  return <div className="col-span-5 px-3.5 pt-2.5 pb-1 sm:px-3">{children}</div>;
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
          <NavbarSpacer />
          <NavbarSection>
            <Dropdown>
              <DropdownButton as={NavbarItem}>
                <Avatar initials={initial} className="bg-blue-600 text-white" />
              </DropdownButton>
              <AccountMenu anchor="bottom end" name={name} email={email} />
            </Dropdown>
          </NavbarSection>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <SidebarItem href="/dashboard">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-600 text-xs font-bold text-white">
                T
              </span>
              <SidebarLabel className="font-semibold">TrackMyEstate</SidebarLabel>
            </SidebarItem>
          </SidebarHeader>

          <SidebarBody>
            <SidebarSection>
              {navItems.map(({ label, href, Icon }) => (
                <SidebarItem key={href} href={href} current={isActive(pathname, href)}>
                  <Icon data-slot="icon" />
                  <SidebarLabel>{label}</SidebarLabel>
                </SidebarItem>
              ))}
            </SidebarSection>

            {isAdmin && (
              <SidebarSection>
                <SidebarHeading>Admin</SidebarHeading>
                {adminNavItems.map(({ label, href, Icon }) => (
                  <SidebarItem
                    key={href}
                    href={href}
                    // "/admin" would otherwise also match "/admin/users" etc.
                    // under the shared prefix rule `isActive` uses elsewhere.
                    current={href === "/admin" ? pathname === "/admin" : isActive(pathname, href)}
                  >
                    <Icon data-slot="icon" />
                    <SidebarLabel>{label}</SidebarLabel>
                  </SidebarItem>
                ))}
              </SidebarSection>
            )}

            <SidebarSpacer />
          </SidebarBody>

          <SidebarFooter>
            <Dropdown>
              <DropdownButton as={SidebarItem}>
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar
                    initials={initial}
                    className="size-8 bg-blue-600 text-white"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">
                      {name}
                    </span>
                    {email && (
                      <span className="block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400">
                        {email}
                      </span>
                    )}
                  </span>
                </span>
                <ChevronUpIcon />
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
