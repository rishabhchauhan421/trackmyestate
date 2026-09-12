import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

/**
 * Shared button/link, styled from the app's theme (blue-600 primary accent,
 * slate neutrals). Renders a `<Link>` when `href` is given, a `<button>`
 * otherwise — so the same component covers both a form submit and a
 * navigation action. `variant` picks the shape (filled vs bordered),
 * `color` picks the palette within that shape.
 */
const baseStyles =
  "inline-flex items-center justify-center gap-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40";

const variantStyles = {
  solid: {
    blue: "bg-blue-600 text-white hover:bg-blue-500",
    slate:
      "bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white",
    red: "bg-red-600 text-white hover:bg-red-500",
    white: "bg-white text-slate-900 hover:bg-blue-50",
  },
  outline: {
    slate:
      "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800",
    red: "border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40",
    amber:
      "border border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/40",
  },
} as const;

const sizeStyles = {
  md: "px-4 py-2",
  sm: "px-2.5 py-1.5 text-xs",
  lg: "px-6 py-3",
};

type SolidColor = keyof typeof variantStyles.solid;
type OutlineColor = keyof typeof variantStyles.outline;

type ButtonProps = (
  | { variant?: "solid"; color?: SolidColor }
  | { variant: "outline"; color?: OutlineColor }
) & {
  size?: keyof typeof sizeStyles;
  /** Fully-rounded pill shape, for the marketing site — the app dashboard stays `rounded-lg`. */
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
  const color =
    props.color ??
    ((variant === "outline" ? "slate" : "blue") as SolidColor & OutlineColor);

  const classes = [
    baseStyles,
    pill ? "rounded-full" : "rounded-lg",
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
