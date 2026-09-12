import { type Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { APIError } from "better-auth";

import { Button } from "~/app/_components/button";
import { SlimLayout } from "~/app/_components/slim-layout";
import { TextField } from "~/app/_components/text-field";
import { auth } from "~/server/better-auth";
import { getSession } from "~/server/better-auth/server";

export const metadata: Metadata = {
  title: "Sign in",
};

async function signInWithEmail(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  try {
    await auth.api.signInEmail({ body: { email, password } });
  } catch (err) {
    const message =
      err instanceof APIError
        ? err.body?.message ?? "Invalid email or password"
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
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }
  const { error } = await searchParams;

  return (
    <SlimLayout>
      <Link href="/" aria-label="Home" className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-600 text-sm font-bold text-white">
          T
        </span>
        <span className="font-display text-sm font-semibold text-slate-900 dark:text-slate-50">
          TrackMyEstate
        </span>
      </Link>

      <h2 className="mt-16 font-display text-lg font-semibold text-slate-900 dark:text-slate-50">
        Sign in to your account
      </h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Use your email and password, or continue with the Google account you
        signed up with.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}

      <form
        action={signInWithEmail}
        data-gtm-event="sign_in_email"
        className="mt-8 grid grid-cols-1 gap-y-6"
      >
        <TextField
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <Button type="submit">
          Sign in <span aria-hidden="true">&rarr;</span>
        </Button>
      </form>

      <div className="mt-8 flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        <span className="text-xs text-slate-400 dark:text-slate-500">or</span>
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>

      <form
        action={signInWithGoogle}
        data-gtm-event="sign_in_google"
        className="mt-6"
      >
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Sign in with Google
        </button>
      </form>
    </SlimLayout>
  );
}
