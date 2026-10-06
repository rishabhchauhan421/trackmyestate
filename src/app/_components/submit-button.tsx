"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "~/app/_components/button";

/**
 * A form's submit button that disables itself and shows a spinner while
 * the form's Server Action runs — and through the redirect that follows —
 * so a slow response can't be submitted twice. Must sit inside the
 * `<form>` it submits (`useFormStatus` reads the nearest parent form).
 */
export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: Extract<ButtonProps, { href?: undefined }> & {
  /** Shown instead of `children` while pending, e.g. "Signing in…". */
  pendingLabel?: ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      {...props}
      type="submit"
      disabled={Boolean(disabled) || pending}
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
    >
      {pending ? (
        <>
          <Spinner />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

function Spinner() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="animate-spin"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        className="opacity-25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
