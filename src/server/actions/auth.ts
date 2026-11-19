"use server";

/**
 * Server Actions for signing in and signing up, thin wrappers over
 * better-auth (see `~/server/better-auth/config`). Each one counts the
 * attempt first (`~/server/rate-limit`) and redirects back to its form with
 * `?error=` on failure, since the auth pages render without client JS.
 *
 * Email/password accounts must confirm their address before they can sign
 * in. Signing up emails a link; signing in to an unconfirmed account sends a
 * fresh one (within the limits) and explains why.
 */

import { APIError } from "better-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { email, parseFormData, text } from "~/lib/form";
import { auth } from "~/server/better-auth";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "~/server/better-auth/config";
import { allowAuthAttempt, RATE_LIMITED_MESSAGE } from "~/server/rate-limit";

/**
 * Where the emailed confirmation link lands. better-auth signs the person
 * in first, so the sign-in page forwards them to the dashboard; a bad or
 * expired link comes back with `&error=<code>` for the page to explain.
 */
const VERIFIED_CALLBACK_URL = "/login?verified=1";

const signInSchema = z.object({
  email: email("Enter a valid email"),
  // Not trimmed: spaces can be part of a password.
  password: z.string({ message: "Enter your password" }).min(1, {
    message: "Enter your password",
  }),
});

const signUpSchema = z
  .object({
    name: text("Enter your name"),
    email: email("Enter a valid email"),
    password: z
      .string({ message: "Choose a password" })
      .min(
        PASSWORD_MIN_LENGTH,
        `Use at least ${PASSWORD_MIN_LENGTH} characters`,
      )
      .max(
        PASSWORD_MAX_LENGTH,
        `Use at most ${PASSWORD_MAX_LENGTH} characters`,
      ),
    confirmPassword: z.string({ message: "Confirm your password" }),
  })
  .refine((fields) => fields.password === fields.confirmPassword, {
    message: "The passwords don't match",
  });

function apiMessage(err: unknown, fallback: string) {
  return err instanceof APIError ? (err.body?.message ?? fallback) : fallback;
}

function backTo(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function signInWithEmail(formData: FormData) {
  let credentials: z.output<typeof signInSchema>;
  try {
    credentials = parseFormData(signInSchema, formData);
  } catch (err) {
    backTo("/login", err instanceof Error ? err.message : "Invalid input");
  }

  if (!(await allowAuthAttempt("signIn", credentials.email))) {
    backTo("/login", RATE_LIMITED_MESSAGE);
  }

  try {
    await auth.api.signInEmail({
      body: credentials,
      headers: await headers(),
    });
  } catch (err) {
    // Only reached with the right password, so it doesn't reveal whether
    // the email has an account.
    if (err instanceof APIError && err.body?.code === "EMAIL_NOT_VERIFIED") {
      if (await allowAuthAttempt("verificationEmail", credentials.email)) {
        await auth.api.sendVerificationEmail({
          body: {
            email: credentials.email,
            callbackURL: VERIFIED_CALLBACK_URL,
          },
          headers: await headers(),
        });
      }
      redirect("/login?unverified=1");
    }
    backTo("/login", apiMessage(err, "Invalid email or password"));
  }

  redirect("/dashboard");
}

export async function signInWithGoogle() {
  const res = await auth.api.signInSocial({
    body: { provider: "google", callbackURL: "/dashboard" },
  });
  if (!res.url) {
    throw new Error("No URL returned from signInSocial");
  }
  redirect(res.url);
}

/**
 * Creates an email/password account and emails a confirmation link. The
 * answer is the same whether or not the email already has an account.
 */
export async function signUpWithEmail(formData: FormData) {
  let fields: z.output<typeof signUpSchema>;
  try {
    fields = parseFormData(signUpSchema, formData);
  } catch (err) {
    backTo("/sign-up", err instanceof Error ? err.message : "Invalid input");
  }

  if (!(await allowAuthAttempt("signUp", fields.email))) {
    backTo("/sign-up", RATE_LIMITED_MESSAGE);
  }

  try {
    await auth.api.signUpEmail({
      body: {
        name: fields.name,
        email: fields.email,
        password: fields.password,
        callbackURL: VERIFIED_CALLBACK_URL,
      },
      headers: await headers(),
    });
  } catch (err) {
    backTo("/sign-up", apiMessage(err, "Couldn't create your account"));
  }

  redirect("/sign-up?sent=1");
}
