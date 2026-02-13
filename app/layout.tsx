// app/layout.tsx
import "./globals.css";

import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Manrope } from "next/font/google";
import { headers } from "next/headers";
import AppHeader from "@/components/AppHeader";
import DevOverflowGuard from "@/components/DevOverflowGuard";

/* =========================================================
   Fonts
========================================================= */

const fontBody = Manrope({
  subsets: ["latin"],
  variable: "--lp-font-body",
  display: "swap",
});

const fontDisplay = Fraunces({
  subsets: ["latin"],
  variable: "--lp-font-display",
  display: "swap",
});

const fontHeading = Inter({
  subsets: ["latin"],
  variable: "--lp-font-heading",
  display: "swap",
  weight: ["600", "700"],
});

/* =========================================================
   Metadata (Favicon korrekt konfigurert)
========================================================= */

export const metadata: Metadata = {
  title: {
    default: "Lunchportalen",
    template: "%s | Lunchportalen",
  },
  description: "Enterprise lunch portal.",
  applicationName: "Lunchportalen",

  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/* =========================================================
   Pathname resolution (server-safe)
========================================================= */

async function resolvePathname(): Promise<string> {
  const h = await headers();

  const pathname = h.get("x-pathname");
  if (pathname) return pathname;

  const nextUrl = h.get("next-url") || "";
  if (nextUrl) {
    try {
      const url = nextUrl.startsWith("http")
        ? new URL(nextUrl)
        : new URL(nextUrl, "http://local");
      return url.pathname || "";
    } catch {
      return nextUrl.split("?")[0] || "";
    }
  }

  try {
    const raw =
      h.get("x-url") ||
      h.get("x-forwarded-uri") ||
      h.get("x-original-url") ||
      h.get("referer") ||
      "";

    if (!raw) return "";

    const url = raw.startsWith("http")
      ? new URL(raw)
      : new URL(raw, "http://local");

    return url.pathname || "";
  } catch {
    return "";
  }
}

/* =========================================================
   Route classification
========================================================= */

function isAuthPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/register" ||
    pathname.startsWith("/register/") ||
    pathname === "/registrering" ||
    pathname.startsWith("/registrering/") ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/forgot-password/") ||
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password/") ||
    pathname === "/logout" ||
    pathname.startsWith("/logout/") ||
    pathname === "/accept-invite" ||
    pathname.startsWith("/accept-invite/") ||
    pathname === "/auth/callback" ||
    pathname.startsWith("/auth/callback/")
  );
}

function isAdminShellPath(pathname: string) {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/superadmin" ||
    pathname.startsWith("/superadmin/")
  );
}

function areaLabelFor(pathname: string) {
  if (!pathname) return "Lunchportalen";

  if (
    pathname.startsWith("/week") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/min-side")
  )
    return "Ansatt";

  if (pathname.startsWith("/kitchen") || pathname.startsWith("/kjokken"))
    return "Kjøkken";

  if (pathname.startsWith("/driver")) return "Sjåfør";
  if (pathname.startsWith("/system")) return "System";

  return "Lunchportalen";
}

function navFor(pathname: string) {
  if (!pathname) return [];

  if (pathname.startsWith("/kitchen") || pathname.startsWith("/kjokken"))
    return [{ label: "Rapport", href: "/kitchen" }];

  if (pathname.startsWith("/driver"))
    return [{ label: "Ruter", href: "/driver" }];

  if (pathname.startsWith("/system"))
    return [{ label: "Status", href: "/system" }];

  return [
    { label: "Ukeplan", href: "/week" },
    { label: "Bestillinger", href: "/orders" },
    { label: "Min side", href: "/min-side" },
  ];
}

/* =========================================================
   Root Layout
========================================================= */

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = await resolvePathname();

  const authRoute = pathname ? isAuthPath(pathname) : false;
  const adminShell = pathname ? isAdminShellPath(pathname) : false;

  const areaLabel = areaLabelFor(pathname);
  const nav = navFor(pathname);

  return (
    <html
      lang="no"
      className={`${fontBody.variable} ${fontDisplay.variable} ${fontHeading.variable} h-full`}
    >
      <body className="min-h-full">
        {process.env.NODE_ENV !== "production" ? (
          <DevOverflowGuard />
        ) : null}

        {authRoute || adminShell ? (
          children
        ) : (
          <div className="lp-page">
            <AppHeader areaLabel={areaLabel} nav={nav} />
            <main className="lp-main">
              <div className="lp-container">{children}</div>
            </main>
          </div>
        )}
      </body>
    </html>
  );
}
