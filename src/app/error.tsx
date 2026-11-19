"use client";

import { useEffect } from "react";

import { Button } from "~/app/_components/button";
import { ProblemPanel } from "~/app/_components/problem-panel";

/** A public page (home, sign-in, …) that failed unexpectedly. */
export default function RootError({
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
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-16">
      <ProblemPanel
        kind="error"
        title="Something went wrong"
        description={
          error.digest
            ? `This page couldn't load (reference ${error.digest}). Please try again.`
            : "This page couldn't load. Please try again."
        }
        actions={
          <>
            <Button onClick={() => retry()}>Try again</Button>
            <Button href="/" variant="outline">
              Go to the home page
            </Button>
          </>
        }
      />
    </main>
  );
}
