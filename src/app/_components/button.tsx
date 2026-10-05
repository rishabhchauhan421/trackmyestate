import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

/**
 * Shared button/link, styled from the design tokens in `globals.css`
 * (`accent` primary, `ink` neutrals). Renders a `<Link>` when `href` is
 * given, a `<button>` otherwise — so the same component covers both a form
 * submit and a navigation action. `variant` picks the shape (filled vs
 * bordered), `color` picks the palette within that shape.
 */
const baseStyles =
  "inline-flex shrink-0 items-center justify-center gap-2 font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4.5 [&_svg]:shrink-0";

const variantStyles = {
  solid: {
    // `blue` is the primary action — the name predates the re-theme and is
    // kept so call sites don't change.
    blue: "bg-accent font-semibold text-on-accent hover:bg-accent-strong",
    slate: "bg-night font-semibold text-white hover:bg-night-3",
    red: "bg-danger font-semibold text-white hover:opacity-90 dark:text-night",
    white: "bg-white font-semibold text-accent-strong hover:bg-accent-soft",
  },
  outline: {
    slate:
      "border border-line-strong bg-surface text-ink hover:border-ink-2/40 hover:bg-sunken",
    red: "border border-danger/30 bg-surface text-danger hover:bg-danger-soft",
    amber: "border border-warn/30 bg-surface text-warn hover:bg-warn-soft",
  },
} as const;

const sizeStyles = {
  md: "h-11 px-4 text-sm",
  sm: "h-9 px-3 text-[0.8125rem]",
  lg: "h-12 px-6 text-base",
};

type SolidColor = keyof typeof variantStyles.solid;
type OutlineColor = keyof typeof variantStyles.outline;

type ButtonProps = (
  | { variant?: "solid"; color?: SolidColor }
  | { variant: "outline"; color?: OutlineColor }
) & {
  size?: keyof typeof sizeStyles;
  /** Fully-rounded pill shape. */
  pill?: boolean;
} & (
    | Omit<ComponentPropsWithoutRef<typeof Link>, "color">
    | (Omit<ComponentPropsWithoutRef<"button">, "color"> & { href?: undefined })
  );

export function Button({
  className,
  size = "md",
  pill = false,
  ...props
}: ButtonProps) {
  const variant = props.variant ?? "solid";
  const color = props.color ?? (variant === "outline" ? "slate" : "blue");

  const classes = [
    baseStyles,
    pill ? "rounded-full" : "rounded-control",
    sizeStyles[size],
    variant === "outline"
      ? variantStyles.outline[color as OutlineColor]
      : variantStyles.solid[color as SolidColor],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return props.href === undefined ? (
    <button className={classes} {...props} />
  ) : (
    <Link className={classes} {...props} />
  );
}
