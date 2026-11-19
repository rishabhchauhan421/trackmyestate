import { Button } from "~/app/_components/button";
import { ProblemPanel } from "~/app/_components/problem-panel";

/**
 * Shown inside the app shell for a record that doesn't exist or isn't in
 * the person's household (pages call `notFound()` for both, so they can't
 * be told apart).
 */
export default function AppNotFound() {
  return (
    <ProblemPanel
      kind="not-found"
      title="We couldn't find that"
      description="It may have been deleted, or it belongs to another account."
      actions={<Button href="/dashboard">Go to dashboard</Button>}
    />
  );
}
