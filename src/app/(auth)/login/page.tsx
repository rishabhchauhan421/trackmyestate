import { type Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { APIError } from "better-auth";
import { z } from "zod";

import { Button } from "~/app/_components/button";
import { SlimLayout } from "~/app/_components/slim-layout";
import { Notice } from "~/app/_components/form";
import { TextField } from "~/app/_components/text-field";
import { email, parseFormData } from "~/lib/form";
import { auth } from "~/server/better-auth";
import { getSession } from "~/server/better-auth/server";

export const metadata: Metadata = {
  title: "Sign in",
};

const signInSchema = z.object({
  email: email("Enter a valid email"),
  // Not trimmed: spaces can be part of a password.
  password: z.string({ message: "Enter your password" }).min(1, {
    message: "Enter your password",
  }),
});

async function signInWithEmail(formData: FormData) {
  "use server";
  let credentials: z.output<typeof signInSchema>;
  try {
    credentials = parseFormData(signInSchema, formData);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid input";
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  try {
    await auth.api.signInEmail({ body: credentials });
  } catch (err) {
    const message =
      err instanceof APIError
        ? (err.body?.message ?? "Invalid email or password")
        : "Invalid email or password";
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  redirect("/dashboard");
}

async function signInWithGoogle() {
  "use server";
  const res = await auth.api.signInSocial({
    body: { provider: "google", callbackURL: "/dashboard" },
  });
  if (!res.url) {
    throw new Error("No URL returned from signInSocial");
  }
  redirect(res.url);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }
  const { error, reset } = await searchParams;

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
      {error && <Notice tone="error">{error}</Notice>}

      <form action={signInWithGoogle} data-gtm-event="sign_in_google">
        <Button type="submit" variant="outline" size="lg" className="w-full">
          <GoogleIcon />
          Continue with Google
        </Button>
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
        <Button type="submit" size="lg" className="w-full">
          Sign in
        </Button>
      </form>
    </SlimLayout>
  );
}

/** Google's multicolour "G" mark for the sign-in button. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8z"
      />
      <path
        fill="#34A853"
        d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9z"
      />
      <path
        fill="#EA4335"
        d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"
      />
    </svg>
  );
}
