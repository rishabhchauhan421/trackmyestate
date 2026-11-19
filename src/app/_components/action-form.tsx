"use client";

import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  type ComponentPropsWithoutRef,
  type FormEvent,
} from "react";

import { Notice } from "~/app/_components/form";

/** What a form's Server Action reports back (see `~/server/form-state`). */
export interface FormState {
  error: string | null;
  field?: string;
}

const ActionFormPending = createContext(false);

/** Whether the surrounding `ActionForm`'s action is running. */
export function useActionFormPending() {
  return useContext(ActionFormPending);
}

/**
 * A `<form>` for a Server Action's `…Form` twin: shows the action's error
 * above the fields instead of crashing the page, and keeps what the person
 * typed (React would otherwise clear the fields after every submit). A
 * successful action redirects as usual. `SubmitButton`s inside show the
 * pending state.
 */
export function ActionForm({
  action,
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<"form">, "action" | "onSubmit"> & {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, {
    error: null,
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // Submitting through a transition (not `<form action>`) keeps the
    // inputs' values when the action reports an error.
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(formData));
  }

  return (
    <form {...props} action={formAction} onSubmit={onSubmit}>
      {state.error && (
        <div className="basis-full">
          <Notice tone="error">{state.error}</Notice>
        </div>
      )}
      <ActionFormPending.Provider value={pending}>
        {children}
      </ActionFormPending.Provider>
    </form>
  );
}
