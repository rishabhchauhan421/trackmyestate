import { type Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "~/app/_components/button";
import { Notice } from "~/app/_components/form";
import { SlimLayout } from "~/app/_components/slim-layout";
import { TextField } from "~/app/_components/text-field";
import { requestPasswordReset } from "~/server/actions/password-reset";
import { getSession } from "~/server/better-auth/server";

export const metadata: Metadata = {
  title: "Forgot password",
};

export default async function ForgotPasswordPage({
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
            <Button type="submit" size="lg" className="w-full">
              Send reset link
            </Button>
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
