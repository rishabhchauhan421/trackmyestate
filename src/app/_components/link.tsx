import * as Headless from "@headlessui/react";
import NextLink, { type LinkProps } from "next/link";
import React, { forwardRef } from "react";

/**
 * Wraps `next/link` in Headless UI's `DataInteractive` so `data-hover` /
 * `data-active` styling (used throughout the sidebar/navbar components)
 * works on plain Next links too.
 */
export const Link = forwardRef(function Link(
  props: LinkProps & React.ComponentPropsWithoutRef<"a">,
  ref: React.ForwardedRef<HTMLAnchorElement>,
) {
  return (
    <Headless.DataInteractive>
      <NextLink {...props} ref={ref} />
    </Headless.DataInteractive>
  );
});
