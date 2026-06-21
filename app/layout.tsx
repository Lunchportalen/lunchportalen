// app/layout.tsx
import "./styles/ds/design-system.css";
import "./globals.css";
import "./styles/ds/foundation.css";
import "./styles/ds/admin-shell.css";
import "./styles/employee-week.css";
import "../lib/ui/motion.css";
import "../lib/ui/design.css";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import DevOverflowGuard from "@/components/DevOverflowGuard";
import AttributionCapture from "@/components/revenue/AttributionCapture";
import { fontBody, fontDisplay, fontHeading } from "@/app/fonts/fonts";
import { htmlLangForAppLocale, parseAppLocale } from "@/lib/i18n/middlewareLocale";

/* =========================================================
   Metadata
========================================================= */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lunchportalen.no";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Lunchportalen", template: "%s | Lunchportalen" },
  description: "Bedriftslunsj uten matsvinn og administrasjon. Fast ramme, cut-off 08:00 og full kontroll for admin.",
  applicationName: "Lunchportalen",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/favicon.ico" }],
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Lunchportalen",
    title: "Lunchportalen",
    description:
      "Bedriftslunsj uten matsvinn og administrasjon. Fast ramme, cut-off 08:00 og full kontroll for admin.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lunchportalen",
    description:
      "Bedriftslunsj uten matsvinn og administrasjon. Fast ramme, cut-off 08:00 og full kontroll for admin.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/* =========================================================
   Root Layout
========================================================= */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const appLocale = parseAppLocale(locale) ?? "nb";

  return (
    <html lang={htmlLangForAppLocale(appLocale)} className={`${fontBody.variable} ${fontDisplay.variable} ${fontHeading.variable} h-full`}>
      <body className="min-h-full antialiased">
        {process.env.NODE_ENV !== "production" ? <DevOverflowGuard /> : null}
        <AttributionCapture />
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
