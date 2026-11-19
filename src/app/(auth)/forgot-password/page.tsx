import { Suspense } from "react";
import { type Metadata } from "next";
import Link from "next/link";

import { SubmitButton } from "~/app/_components/submit-button";
import { Notice } from "~/app/_components/form";
import { SlimLayout } from "~/app/_components/slim-layout";
import { SlimLayoutSkeleton } from "~/app/_components/skeleton";
import { TextField } from "~/app/_components/text-field";
import { requestPasswordReset } from "~/server/actions/password-reset";
import { SignedInRedirect } from "../signed-in-redirect";

export const metadata: Metadata = {
  title: "Forgot password",
};

async function ForgotPasswordPageContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

  return (
    <SlimLayout
      title="Reset your password"
      description={
        sent
          ? undefined
          : "Enter the email you sign in with and we'll send you a link to choose a new password."
      }
    >
      {sent ? (
        <Notice tone="success">
          If an account exists for that email, we&apos;ve sent a link to reset
          your password. It expires in 1 hour.
        </Notice>
      ) : (
        <>
          {error && <Notice tone="error">{error}</Notice>}
          <form
            action={requestPasswordReset}
            data-gtm-event="request_password_reset"
            className="space-y-5"
          >
            <TextField
              label="Email address"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
            <SubmitButton size="lg" className="w-full" pendingLabel="Sending…">
              Send reset link
            </SubmitButton>
          </form>
        </>
      )}

      <p className="text-sm text-muted">
        Remembered it?{" "}
        <Link
          href="/login"
          className="font-semibold text-accent hover:text-accent-strong"
        >
          Back to sign in
        </Link>
      </p>
    </SlimLayout>
  );
}

/**
 * What this page shows depends on the address it was opened with, so the
 * frame and title are prerendered and the rest streams in behind them.
 */
export default function ForgotPasswordPage(
  props: Parameters<typeof ForgotPasswordPageContent>[0],
) {
  return (
    <>
      <Suspense fallback={null}>
        <SignedInRedirect />
      </Suspense>
      <Suspense fallback={<SlimLayoutSkeleton title="Reset your password" />}>
        <ForgotPasswordPageContent {...props} />
      </Suspense>
    </>
  );
}
