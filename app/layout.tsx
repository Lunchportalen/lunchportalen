// app/layout.tsx
import "./globals.css";
import "../lib/ui/motion.css";
import "../lib/ui/design.css";

import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Manrope } from "next/font/google";
import type { ReactNode } from "react";

import DevOverflowGuard from "@/components/DevOverflowGuard";

/* =========================================================
   Fonts
========================================================= */
const fontBody = Manrope({ subsets: ["latin"], variable: "--lp-font-body", display: "swap" });
const fontDisplay = Fraunces({ subsets: ["latin"], variable: "--lp-font-display", display: "swap" });
const fontHeading = Inter({
  subsets: ["latin"],
  variable: "--lp-font-heading",
  display: "swap",
  weight: ["600", "700"],
});

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
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="no" className={`${fontBody.variable} ${fontDisplay.variable} ${fontHeading.variable} h-full`}>
      <body className="min-h-full antialiased">
        {process.env.NODE_ENV !== "production" ? <DevOverflowGuard /> : null}
        {children}
      </body>
    </html>
  );
}
