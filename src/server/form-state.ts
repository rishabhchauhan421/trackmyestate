/**
 * Lets a Server Action report a form's problems back to the form instead
 * of throwing them to the error page. In production Next.js hides the
 * message of an error thrown from a Server Action, so "Enter a valid
 * amount" would otherwise become a generic crash.
 *
 * Each form-facing action has a `…Form` twin (e.g. `createLoanForm`) with
 * the `useActionState` signature `(state, formData) => FormState`, used by
 * `ActionForm` (`~/app/_components/action-form`). The twin runs the plain
 * action and turns a `FormError` into `{ error }`; anything else (a bug, a
 * database outage) is rethrown, and `redirect()` passes straight through.
 */
import "server-only";

import { unstable_rethrow } from "next/navigation";

import { FormError } from "~/lib/form";

export interface FormState {
  /** What to tell the person, or null when there's nothing to fix. */
  error: string | null;
  /** The input the error is about, when there is one. */
  field?: string;
}

export const INITIAL_FORM_STATE: FormState = { error: null };

/** Runs `action`, returning a `FormError` as state instead of throwing it. */
export async function toFormState(
  action: () => Promise<unknown>,
): Promise<FormState> {
  try {
    await action();
    return { error: null };
  } catch (err) {
    // `redirect()` and `notFound()` work by throwing; let Next.js see them.
    unstable_rethrow(err);
    if (err instanceof FormError) {
      return { error: err.message, field: err.field };
    }
    throw err;
  }
}
