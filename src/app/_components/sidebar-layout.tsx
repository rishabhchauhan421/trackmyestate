"use client";

import * as Headless from "@headlessui/react";
import { usePathname } from "next/navigation";
import React, { Suspense, useState } from "react";

import { NavbarItem } from "./navbar";

function OpenMenuIcon() {
  return (
    <svg
      data-slot="icon"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M2 6.75C2 6.33579 2.33579 6 2.75 6H17.25C17.6642 6 18 6.33579 18 6.75C18 7.16421 17.6642 7.5 17.25 7.5H2.75C2.33579 7.5 2 7.16421 2 6.75ZM2 13.25C2 12.8358 2.33579 12.5 2.75 12.5H17.25C17.6642 12.5 18 12.8358 18 13.25C18 13.6642 17.6642 14 17.25 14H2.75C2.33579 14 2 13.6642 2 13.25Z" />
    </svg>
  );
}

function CloseMenuIcon() {
  return (
    <svg
      data-slot="icon"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  );
}

function MobileSidebar({
  open,
  close,
  children,
}: React.PropsWithChildren<{ open: boolean; close: () => void }>) {
  return (
    <Headless.Dialog open={open} onClose={close} className="lg:hidden">
      <Headless.DialogBackdrop
        transition
        className="fixed inset-0 bg-black/30 transition data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
      />
      <Headless.DialogPanel
        transition
        className="fixed inset-y-0 w-full max-w-72 transition duration-300 ease-in-out data-closed:-translate-x-full"
      >
        <div className="relative flex h-full flex-col bg-night shadow-xl">
          <Headless.CloseButton
            aria-label="Close navigation"
            className="absolute top-4 right-3 z-10 flex size-10 items-center justify-center rounded-control text-night-ink *:size-5 *:fill-current hover:bg-white/10 hover:text-white"
          >
            <CloseMenuIcon />
          </Headless.CloseButton>
          {children}
        </div>
      </Headless.DialogPanel>
    </Headless.Dialog>
  );
}

/**
 * The mobile sidebar, open only while the visitor is still on the route
 * it was opened on.
 */
function MobileSidebarOnRoute({
  openedOn,
  close,
  children,
}: React.PropsWithChildren<{ openedOn: string | null; close: () => void }>) {
  const pathname = usePathname();
  return (
    <MobileSidebar open={openedOn === pathname} close={close}>
      {children}
    </MobileSidebar>
  );
}

/** The menu button: reports the route it was pressed on. */
function OpenSidebarButton({ onOpen }: { onOpen: (pathname: string) => void }) {
  const pathname = usePathname();
  return (
    <NavbarItem onClick={() => onOpen(pathname)} aria-label="Open navigation">
      <OpenMenuIcon />
    </NavbarItem>
  );
}

export function SidebarLayout({
  navbar,
  sidebar,
  children,
}: React.PropsWithChildren<{
  navbar: React.ReactNode;
  sidebar: React.ReactNode;
}>) {
  // The mobile sidebar remembers the route it was opened on and counts as
  // open only while we're still there, so any navigation from inside it
  // closes it — including links in its dropdowns (Settings, Add asset),
  // which close their menu but not the surrounding dialog.
  //
  // The two parts that read the route sit behind `<Suspense>`: on a page
  // whose address has a dynamic part (`/properties/[id]`) the route isn't
  // known while this frame is prerendered, and without the boundaries the
  // whole frame would have to wait for the request.
  const [openedOn, setOpenedOn] = useState<string | null>(null);

  return (
    <div className="relative isolate flex min-h-svh w-full bg-ground max-lg:flex-col">
      {/* Sidebar on desktop */}
      <div className="fixed inset-y-0 left-0 w-64 max-lg:hidden">{sidebar}</div>

      {/* Sidebar on mobile */}
      <Suspense fallback={null}>
        <MobileSidebarOnRoute
          openedOn={openedOn}
          close={() => setOpenedOn(null)}
        >
          {sidebar}
        </MobileSidebarOnRoute>
      </Suspense>

      {/* Navbar on mobile */}
      <header className="sticky top-0 z-20 flex items-center border-b border-line bg-surface/95 px-3 backdrop-blur lg:hidden">
        <div className="py-2.5">
          <Suspense
            fallback={
              <NavbarItem aria-label="Open navigation">
                <OpenMenuIcon />
              </NavbarItem>
            }
          >
            <OpenSidebarButton onOpen={setOpenedOn} />
          </Suspense>
        </div>
        <div className="min-w-0 flex-1">{navbar}</div>
      </header>

      {/* Content */}
      <main className="flex flex-1 flex-col lg:min-w-0 lg:pl-64">
        <div className="mx-auto w-full max-w-300 grow space-y-7 px-4 pt-6 pb-14 sm:px-6 lg:px-10 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
