/**
 * Transactional emails better-auth asks us to send (see the
 * `emailAndPassword` hooks in `./config.ts`).
 */
import "server-only";

import {
  renderTransactionalEmail,
  sendTransactionalEmail,
} from "~/server/email/send";

/** Emails a password reset link. */
export async function sendPasswordResetEmail({
  to,
  name,
  url,
}: {
  to: string;
  name: string;
  url: string;
}) {
  const { html, text } = renderTransactionalEmail({
    heading: "Reset your password",
    paragraphs: [
      name ? `Hi ${name},` : "Hi,",
      "We received a request to reset the password for your TrackMyEstate account. This link expires in 1 hour.",
    ],
    button: { label: "Reset password", url },
    footnote:
      "If you didn't ask for this, you can ignore this email — your password won't change.",
  });

  await sendTransactionalEmail({
    to,
    subject: "Reset your TrackMyEstate password",
    html,
    text,
  });
}
