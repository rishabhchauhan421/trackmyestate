"use client";

import { useEffect } from "react";

import { Button } from "~/app/_components/button";
import { ProblemPanel } from "~/app/_components/problem-panel";

/**
 * Shown inside the app shell when a page fails unexpectedly (expected
 * problems, like a form's bad input, are shown on the form itself). The
 * sidebar stays, so the person can retry or go elsewhere.
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ProblemPanel
      kind="error"
      title="Something went wrong"
      description={
        <>
          This page couldn&apos;t load. Try again, and if it keeps happening,
          let us know
          {error.digest ? ` (reference ${error.digest})` : ""}.
        </>
      }
      actions={
        <>
          <Button onClick={() => retry()}>Try again</Button>
          <Button href="/dashboard" variant="outline">
            Go to dashboard
          </Button>
        </>
      }
    />
  );
}
