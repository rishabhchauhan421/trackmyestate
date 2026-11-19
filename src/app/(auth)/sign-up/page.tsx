import { type Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Notice } from "~/app/_components/form";
import { GoogleIcon } from "~/app/_components/google-icon";
import { SlimLayout } from "~/app/_components/slim-layout";
import { SubmitButton } from "~/app/_components/submit-button";
import { TextField } from "~/app/_components/text-field";
import { signInWithGoogle, signUpWithEmail } from "~/server/actions/auth";
import { PASSWORD_MIN_LENGTH } from "~/server/better-auth/config";
import { getSession } from "~/server/better-auth/server";

export const metadata: Metadata = {
  title: "Create an account",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }
  const { error, sent } = await searchParams;

  return (
    <SlimLayout
      title={sent ? "Check your inbox" : "Create your account"}
      description={
        sent ? undefined : "Track rent, EMIs, premiums and bills in one place."
      }
    >
      {sent ? (
        <Notice tone="success">
          We&apos;ve sent a link to confirm your email. Open it within 24 hours
          to finish setting up your account.
        </Notice>
      ) : (
        <>
          {error && <Notice tone="error">{error}</Notice>}

          <form action={signInWithGoogle} data-gtm-event="sign_up_google">
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
            action={signUpWithEmail}
            data-gtm-event="sign_up_email"
            className="space-y-5"
          >
            <TextField
              label="Your name"
              name="name"
              autoComplete="name"
              required
            />
            <TextField
              label="Email address"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
            <TextField
              label="Password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              required
            />
            <TextField
              label="Confirm password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              required
            />
            <SubmitButton
              size="lg"
              className="w-full"
              pendingLabel="Creating account…"
            >
              Create account
            </SubmitButton>
          </form>
        </>
      )}

      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-accent hover:text-accent-strong"
        >
          Sign in
        </Link>
      </p>
    </SlimLayout>
  );
}
