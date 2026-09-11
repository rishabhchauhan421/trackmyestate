import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { env } from "~/env";
import { TRPCReactProvider } from "~/trpc/react";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default:
      "TrackMyEstate — Free Property, Policy, Loan and Investment Tracker",
    template: "%s | TrackMyEstate",
  },
  description:
    "Aggregate every property, insurance policy, investment and loan in one place, free. Get reminders for premiums, EMIs, rent and maturities before you miss a date.",
  applicationName: "TrackMyEstate",
  keywords: [
    "free personal asset tracker",
    "property management app",
    "insurance premium reminder",
    "investment tracker",
    "loan EMI tracker",
    "net worth tracker",
  ],
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
  openGraph: {
    type: "website",
    siteName: "TrackMyEstate",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
