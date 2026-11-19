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

/** Emails the link that confirms a new account's address. */
export async function sendVerificationEmail({
  to,
  name,
  url,
}: {
  to: string;
  name: string;
  url: string;
}) {
  const { html, text } = renderTransactionalEmail({
    heading: "Confirm your email",
    paragraphs: [
      name ? `Hi ${name},` : "Hi,",
      "Confirm this is your email address to finish setting up your TrackMyEstate account. This link expires in 24 hours.",
    ],
    button: { label: "Confirm email", url },
    footnote:
      "If you didn't create an account, you can ignore this email — nothing will be set up.",
  });

  await sendTransactionalEmail({
    to,
    subject: "Confirm your TrackMyEstate email",
    html,
    text,
  });
}
