import { Suspense } from "react";
import { type Metadata } from "next";

import { Button } from "~/app/_components/button";
import { SubmitButton } from "~/app/_components/submit-button";
import { Notice } from "~/app/_components/form";
import { SlimLayout } from "~/app/_components/slim-layout";
import { SlimLayoutSkeleton } from "~/app/_components/skeleton";
import { TextField } from "~/app/_components/text-field";
import { resetPassword } from "~/server/actions/password-reset";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "~/server/better-auth/config";

export const metadata: Metadata = {
  title: "Choose a new password",
};

/**
 * Landing page for the emailed reset link. better-auth's
 * `/api/auth/reset-password/:token` checks the token first and redirects
 * here with `?token=` when it's valid, or `?error=INVALID_TOKEN` when it's
 * expired or already used.
 */
async function ResetPasswordPageContent({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const linkInvalid = !token || error === "INVALID_TOKEN";

  return (
    <SlimLayout
      title="Choose a new password"
      description={
        linkInvalid
          ? undefined
          : "You'll be signed out everywhere else once it's changed."
      }
    >
      {linkInvalid ? (
        <>
          <Notice tone="error">
            This reset link is invalid or has expired. Reset links work once and
            last 1 hour.
          </Notice>
          <Button href="/forgot-password" size="lg" className="w-full">
            Request a new link
          </Button>
        </>
      ) : (
        <>
          {error && <Notice tone="error">{error}</Notice>}
          <form
            action={resetPassword}
            data-gtm-event="reset_password"
            className="space-y-5"
          >
            <input type="hidden" name="token" value={token} />
            <TextField
              label="New password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              required
            />
            <TextField
              label="Confirm new password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              required
            />
            <SubmitButton size="lg" className="w-full" pendingLabel="Updating…">
              Update password
            </SubmitButton>
          </form>
        </>
      )}
    </SlimLayout>
  );
}

/**
 * What this page shows depends on the address it was opened with, so the
 * frame and title are prerendered and the rest streams in behind them.
 */
export default function ResetPasswordPage(
  props: Parameters<typeof ResetPasswordPageContent>[0],
) {
  return (
    <>
      <Suspense fallback={<SlimLayoutSkeleton title="Choose a new password" />}>
        <ResetPasswordPageContent {...props} />
      </Suspense>
    </>
  );
}
