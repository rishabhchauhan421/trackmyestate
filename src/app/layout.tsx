import "~/styles/globals.css";

import { GoogleTagManager } from "@next/third-parties/google";
import { type Metadata } from "next";
import { Bricolage_Grotesque, Geist } from "next/font/google";

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

// UI text.
const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
});

// Headings and headline figures (`font-display`).
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-bricolage",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable} ${bricolage.variable}`}>
      {env.NEXT_PUBLIC_GTM_ID && (
        <GoogleTagManager gtmId={env.NEXT_PUBLIC_GTM_ID} />
      )}
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
