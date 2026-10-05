"use server";

/**
 * Server Actions for "forgot password". Two steps, both thin wrappers over
 * better-auth (see `emailAndPassword` in `~/server/better-auth/config`):
 *
 * 1. `requestPasswordReset` — emails a single-use link (valid 1 hour). The
 *    link goes through better-auth's token check, which redirects to
 *    `/reset-password?token=...` (or `?error=INVALID_TOKEN`).
 * 2. `resetPassword` — sets the new password from that page and signs out
 *    every existing session.
 *
 * Errors redirect back to the form with `?error=` (same as sign-in), since
 * these pages render without client JS.
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

const requestResetSchema = z.object({
  email: email("Enter a valid email"),
});

const resetPasswordSchema = z
  .object({
    token: text("This reset link is invalid or has expired"),
    // Not trimmed: spaces can be part of a password.
    password: z
      .string({ message: "Enter a new password" })
      .min(
        PASSWORD_MIN_LENGTH,
        `Use at least ${PASSWORD_MIN_LENGTH} characters`,
      )
      .max(
        PASSWORD_MAX_LENGTH,
        `Use at most ${PASSWORD_MAX_LENGTH} characters`,
      ),
    confirmPassword: z.string({ message: "Confirm your new password" }),
  })
  .refine((fields) => fields.password === fields.confirmPassword, {
    message: "The passwords don't match",
  });

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

/** Step 1: emails a reset link, if an account with that email exists. */
export async function requestPasswordReset(formData: FormData) {
  let fields: z.output<typeof requestResetSchema>;
  try {
    fields = parseFormData(requestResetSchema, formData);
  } catch (err) {
    const message = errorMessage(err, "Enter a valid email");
    redirect(`/forgot-password?error=${encodeURIComponent(message)}`);
  }

  try {
    await auth.api.requestPasswordReset({
      body: { email: fields.email, redirectTo: "/reset-password" },
      headers: await headers(),
    });
  } catch (err) {
    // better-auth answers the same way whether or not the account exists,
    // so an error here is a real failure (rate limit, misconfiguration).
    const message =
      err instanceof APIError
        ? (err.body?.message ?? "Couldn't send the reset email")
        : "Couldn't send the reset email";
    redirect(`/forgot-password?error=${encodeURIComponent(message)}`);
  }

  // Shown whether or not the email has an account, so this form can't be
  // used to find out who's registered.
  redirect("/forgot-password?sent=1");
}

/** Step 2: sets a new password using the token from the emailed link. */
export async function resetPassword(formData: FormData) {
  const token = formData.get("token");
  // A function declaration (not an arrow) so TypeScript knows it never
  // returns and treats `fields` as assigned after the `catch` below.
  function backToForm(message: string): never {
    const tokenParam = typeof token === "string" ? token : "";
    redirect(
      `/reset-password?token=${encodeURIComponent(tokenParam)}&error=${encodeURIComponent(message)}`,
    );
  }

  let fields: z.output<typeof resetPasswordSchema>;
  try {
    fields = parseFormData(resetPasswordSchema, formData);
  } catch (err) {
    backToForm(errorMessage(err, "Enter a valid password"));
  }

  try {
    await auth.api.resetPassword({
      body: { token: fields.token, newPassword: fields.password },
      headers: await headers(),
    });
  } catch (err) {
    if (err instanceof APIError && err.body?.code === "INVALID_TOKEN") {
      redirect("/reset-password?error=INVALID_TOKEN");
    }
    backToForm(
      err instanceof APIError
        ? (err.body?.message ?? "Couldn't reset your password")
        : "Couldn't reset your password",
    );
  }

  redirect("/login?reset=1");
}
