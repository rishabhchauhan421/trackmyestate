"use client";

import * as Headless from "@headlessui/react";
import clsx from "clsx";
import React, { forwardRef } from "react";

import { Link } from "./link";
import { TouchTarget } from "./touch-target";

export function Navbar({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"nav">) {
  return (
    <nav
      {...props}
      className={clsx(className, "flex flex-1 items-center gap-4 py-2.5")}
    />
  );
}

export function NavbarSection({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div {...props} className={clsx(className, "flex items-center gap-3")} />
  );
}

export function NavbarSpacer({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      aria-hidden="true"
      {...props}
      className={clsx(className, "-ml-4 flex-1")}
    />
  );
}

export const NavbarItem = forwardRef(function NavbarItem(
  {
    current,
    className,
    children,
    ...props
  }: { current?: boolean; className?: string; children: React.ReactNode } & (
    | ({ href?: never } & Omit<Headless.ButtonProps, "as" | "className">)
    | ({ href: string } & Omit<
        React.ComponentPropsWithoutRef<typeof Link>,
        "className"
      >)
  ),
  ref: React.ForwardedRef<HTMLAnchorElement | HTMLButtonElement>,
) {
  const classes = clsx(
    "relative flex min-w-0 items-center gap-3 rounded-control p-2 text-left text-base/6 font-medium text-ink sm:text-sm/5",
    "*:data-[slot=icon]:size-6 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:text-muted sm:*:data-[slot=icon]:size-5",
    "*:not-nth-2:last:data-[slot=icon]:ml-auto *:not-nth-2:last:data-[slot=icon]:size-5 sm:*:not-nth-2:last:data-[slot=icon]:size-4",
    "*:data-[slot=avatar]:-m-0.5 *:data-[slot=avatar]:size-8 *:data-[slot=avatar]:[--avatar-radius:var(--radius-md)]",
    "data-hover:bg-sunken-2 data-hover:*:data-[slot=icon]:text-ink",
    "data-active:bg-sunken-2 data-active:*:data-[slot=icon]:text-ink",
  );

  return (
    <span className={clsx(className, "relative")}>
      {typeof props.href === "string" ? (
        <Link
          {...props}
          className={classes}
          data-current={current ? "true" : undefined}
          ref={ref as React.ForwardedRef<HTMLAnchorElement>}
        >
          <TouchTarget>{children}</TouchTarget>
        </Link>
      ) : (
        <Headless.Button
          {...props}
          className={clsx("cursor-default", classes)}
          data-current={current ? "true" : undefined}
          ref={ref}
        >
          <TouchTarget>{children}</TouchTarget>
        </Headless.Button>
      )}
    </span>
  );
});
