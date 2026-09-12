"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "~/server/better-auth";

/** Server Action for the sign-out button in the app shell's account menu (a client component, so this can't be an inline action). */
export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}
