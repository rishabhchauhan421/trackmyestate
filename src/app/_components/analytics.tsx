"use client";

import { sendGTMEvent } from "@next/third-parties/google";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Fires a `page_view` GTM event on every client-side route change. The
 * initial page load is already covered by GTM's own container-load event,
 * so this only needs to watch for `pathname` changing afterward.
 */
export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    sendGTMEvent({ event: "page_view", page_path: pathname });
  }, [pathname]);

  return null;
}

/**
 * Fires a GTM event whenever a `<form data-gtm-event="...">` anywhere on the
 * page is submitted — one global listener instead of turning every
 * server-action form page into a client component just to call
 * `sendGTMEvent`. Every tracked form in the app (loans, leases, utilities,
 * investments, rentals, sign-in/out) opts in by adding `data-gtm-event`
 * directly on its own `<form>` element.
 *
 * This fires on submit intent, not confirmed success — there's no
 * client-visible signal when a Server Action actually completes vs. throws,
 * so "the user tried to do X" is what gets tracked here, same as most GTM
 * form-tracking setups.
 */
export function FormEventListener() {
  useEffect(() => {
    function handleSubmit(event: SubmitEvent) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const gtmEvent = form.dataset.gtmEvent;
      if (gtmEvent) sendGTMEvent({ event: gtmEvent });
    }

    document.addEventListener("submit", handleSubmit, true);
    return () => document.removeEventListener("submit", handleSubmit, true);
  }, []);

  return null;
}
