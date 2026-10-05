"use client";

import * as Headless from "@headlessui/react";
import clsx from "clsx";
import React, { forwardRef } from "react";

import { Link } from "./link";
import { TouchTarget } from "./touch-target";

export function Sidebar({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"nav">) {
  return (
    <nav
      {...props}
      className={clsx(
        className,
        "flex h-full min-h-0 flex-col bg-night text-night-ink",
      )}
    />
  );
}

export function SidebarHeader({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        "flex flex-col gap-4 p-4 pt-5 [&>[data-slot=section]+[data-slot=section]]:mt-2.5",
      )}
    />
  );
}

export function SidebarBody({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        "flex flex-1 flex-col overflow-y-auto px-4 pb-4 [&>[data-slot=section]+[data-slot=section]]:mt-6",
      )}
    />
  );
}

export function SidebarFooter({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        "flex flex-col gap-3 border-t border-white/10 p-4 [&>[data-slot=section]+[data-slot=section]]:mt-2.5",
      )}
    />
  );
}

export function SidebarSection({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      data-slot="section"
      className={clsx(className, "flex flex-col gap-0.5")}
    />
  );
}

export function SidebarSpacer({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      aria-hidden="true"
      {...props}
      className={clsx(className, "mt-8 flex-1")}
    />
  );
}

export function SidebarHeading({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"h3">) {
  return (
    <h3
      {...props}
      className={clsx(
        className,
        "mb-1 px-3 text-[0.6875rem]/6 font-semibold tracking-[0.08em] text-night-muted uppercase",
      )}
    />
  );
}

export const SidebarItem = forwardRef(function SidebarItem(
  {
    current,
    className,
    children,
    ...props
  }: { current?: boolean; className?: string; children: React.ReactNode } & (
    | ({ href?: never } & Omit<Headless.ButtonProps, "as" | "className">)
    | ({ href: string } & Omit<
        Headless.ButtonProps<typeof Link>,
        "as" | "className"
      >)
  ),
  ref: React.ForwardedRef<HTMLAnchorElement | HTMLButtonElement>,
) {
  // Icons use `text-*` (currentColor), not `fill-*`: the app's icons are
  // outline icons drawn with `stroke="currentColor"`, and filling them turns
  // the selected one into a solid blob.
  const classes = clsx(
    "flex w-full items-center gap-3 rounded-[9px] px-3 py-2.5 text-left text-base/6 font-medium text-night-ink transition-colors sm:py-2 sm:text-sm/6",
    "*:data-[slot=icon]:size-6 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:text-night-muted sm:*:data-[slot=icon]:size-5",
    "*:last:data-[slot=icon]:ml-auto *:last:data-[slot=icon]:size-5 sm:*:last:data-[slot=icon]:size-4",
    "*:data-[slot=avatar]:-m-0.5 *:data-[slot=avatar]:size-7 sm:*:data-[slot=avatar]:size-8",
    "data-hover:bg-white/5 data-hover:text-white data-hover:*:data-[slot=icon]:text-white",
    "data-active:bg-white/10",
    "data-current:bg-night-3 data-current:text-white data-current:shadow-[inset_3px_0_0_var(--color-mint)] data-current:*:data-[slot=icon]:text-mint",
  );

  return (
    <span className={clsx(className, "relative")}>
      {typeof props.href === "string" ? (
        <Headless.CloseButton
          as={Link}
          {...props}
          className={classes}
          data-current={current ? "true" : undefined}
          aria-current={current ? "page" : undefined}
          ref={ref}
        >
          <TouchTarget>{children}</TouchTarget>
        </Headless.CloseButton>
      ) : (
        <Headless.Button
          {...props}
          className={clsx("cursor-default", classes)}
          data-current={current ? "true" : undefined}
          aria-current={current ? "page" : undefined}
          ref={ref}
        >
          <TouchTarget>{children}</TouchTarget>
        </Headless.Button>
      )}
    </span>
  );
});

export function SidebarLabel({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"span">) {
  return <span {...props} className={clsx(className, "truncate")} />;
}
