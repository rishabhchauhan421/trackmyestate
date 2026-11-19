import { type Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SubmitButton } from "~/app/_components/submit-button";
import { SlimLayout } from "~/app/_components/slim-layout";
import { Notice } from "~/app/_components/form";
import { GoogleIcon } from "~/app/_components/google-icon";
import { TextField } from "~/app/_components/text-field";
import { signInWithEmail, signInWithGoogle } from "~/server/actions/auth";
import { getSession } from "~/server/better-auth/server";

export const metadata: Metadata = {
  title: "Sign in",
};

/** What to say when an emailed confirmation link didn't work. */
const VERIFY_LINK_ERRORS: Record<string, string> = {
  TOKEN_EXPIRED:
    "That confirmation link has expired. Sign in and we'll send you a new one.",
  INVALID_TOKEN:
    "That confirmation link isn't valid. Sign in and we'll send you a new one.",
  USER_NOT_FOUND: "We couldn't find the account for that confirmation link.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    reset?: string;
    unverified?: string;
    verified?: string;
  }>;
}) {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }
  const { error, reset, unverified, verified } = await searchParams;
  const errorMessage =
    verified && error ? (VERIFY_LINK_ERRORS[error] ?? error) : error;

  return (
    <SlimLayout
      title="Welcome back"
      description="Sign in to see what's due this week."
    >
      {reset && (
        <Notice tone="success">
          Your password has been changed. Sign in with your new password.
        </Notice>
      )}
      {unverified && (
        <Notice tone="success">
          Confirm your email to sign in. We&apos;ve sent a new link to your
          inbox; it expires in 24 hours.
        </Notice>
      )}
      {errorMessage && <Notice tone="error">{errorMessage}</Notice>}

      <form action={signInWithGoogle} data-gtm-event="sign_in_google">
        <SubmitButton
          variant="outline"
          size="lg"
          className="w-full"
          pendingLabel="Opening Google…"
        >
          <GoogleIcon />
          Continue with Google
        </SubmitButton>
      </form>

      <div className="flex items-center gap-3 text-[0.8125rem] text-muted">
        <span className="h-px flex-1 bg-line" />
        or with email
        <span className="h-px flex-1 bg-line" />
      </div>

      <form
        action={signInWithEmail}
        data-gtm-event="sign_in_email"
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
        <div className="space-y-2">
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <div className="text-right">
            <Link
              href="/forgot-password"
              className="text-[0.8125rem] font-medium text-accent hover:text-accent-strong"
            >
              Forgot password?
            </Link>
          </div>
        </div>
        <SubmitButton size="lg" className="w-full" pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </form>

      <p className="text-sm text-muted">
        New to TrackMyEstate?{" "}
        <Link
          href="/sign-up"
          className="font-semibold text-accent hover:text-accent-strong"
        >
          Create an account
        </Link>
      </p>
    </SlimLayout>
  );
}
