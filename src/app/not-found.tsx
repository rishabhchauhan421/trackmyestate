import { Button } from "~/app/_components/button";
import { ProblemPanel } from "~/app/_components/problem-panel";

/** Any URL that matches no page. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-16">
      <ProblemPanel
        kind="not-found"
        title="Page not found"
        description="The link may be old, or the address mistyped."
        actions={<Button href="/">Go to the home page</Button>}
      />
    </main>
  );
}
