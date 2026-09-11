/**
 * Client Component-facing auth client (better-auth's React bindings). Use
 * this from `"use client"` components that need to sign in/out or read
 * session state reactively; Server Components should use `./server.ts`
 * instead.
 */
import { createAuthClient } from "better-auth/react";

/** better-auth React client, for use in Client Components. */
export const authClient = createAuthClient();

/** Inferred session/user shape, as seen from the client. */
export type Session = typeof authClient.$Infer.Session;
