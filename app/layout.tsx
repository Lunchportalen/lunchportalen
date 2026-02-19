// app/layout.tsx
import "./globals.css";

import type { Metadata, Viewport } from "next";
import React from "react";
import { Fraunces, Inter, Manrope } from "next/font/google";
import { headers } from "next/headers";
import Link from "next/link";

import PublicHeader from "@/components/site/PublicHeader";
import AdminHeader from "@/components/site/AdminHeader";
import AppFooter from "@/components/AppFooter";
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
   Metadata (inkl. metadataBase for å fjerne warning)
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
   Pathname resolution (server-safe)
========================================================= */
function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function firstPathSegment(pathname: string) {
  const p = safeStr(pathname);
  if (!p || p === "/") return "/";
  const q = p.indexOf("?");
  const h = p.indexOf("#");
  const cut = Math.min(q === -1 ? p.length : q, h === -1 ? p.length : h);
  const clean = p.slice(0, cut);
  return clean || "/";
}

async function resolvePathname(): Promise<string> {
  const h = await headers();

  const fromMw = safeStr(h.get("x-pathname"));
  if (fromMw) return firstPathSegment(fromMw);

  const nextUrl = safeStr(h.get("next-url"));
  if (nextUrl) {
    try {
      const url = nextUrl.startsWith("http") ? new URL(nextUrl) : new URL(nextUrl, "http://local");
      return firstPathSegment(url.pathname || "");
    } catch {
      return firstPathSegment(nextUrl.split("?")[0] || "");
    }
  }

  try {
    const raw =
      safeStr(h.get("x-url")) ||
      safeStr(h.get("x-forwarded-uri")) ||
      safeStr(h.get("x-original-url")) ||
      safeStr(h.get("referer")) ||
      "";

    if (!raw) return "";
    const url = raw.startsWith("http") ? new URL(raw) : new URL(raw, "http://local");
    return firstPathSegment(url.pathname || "");
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

function isAdminPath(pathname: string) {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/superadmin" ||
    pathname.startsWith("/superadmin/") ||
    pathname === "/system" ||
    pathname.startsWith("/system/") ||
    pathname === "/kitchen" ||
    pathname.startsWith("/kitchen/") ||
    pathname === "/driver" ||
    pathname.startsWith("/driver/")
  );
}

function isSuperadminPath(pathname: string) {
  return pathname === "/superadmin" || pathname.startsWith("/superadmin/");
}

/* =========================================================
   Nav
========================================================= */
type NavItem = { label: string; href: string };

function navForAdmin(pathname: string): NavItem[] {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return [
      { label: "Dashboard", href: "/admin" },
      { label: "Avtale", href: "/admin/agreement" },
      { label: "Ordre", href: "/admin/orders" },
      { label: "Ansatte", href: "/admin/employees" },
    ];
  }

  if (pathname === "/superadmin" || pathname.startsWith("/superadmin/")) {
    return [
      { label: "Oversikt", href: "/superadmin" },
      { label: "Firma", href: "/superadmin/companies" },
      { label: "Avtaler", href: "/superadmin/agreements" },
      { label: "System", href: "/system" },
    ];
  }

  if (pathname.startsWith("/kitchen") || pathname.startsWith("/kjokken")) {
    return [{ label: "Rapport", href: "/kitchen" }];
  }
  if (pathname.startsWith("/driver")) {
    return [{ label: "Ruter", href: "/driver" }];
  }
  if (pathname.startsWith("/system")) {
    return [{ label: "Status", href: "/system" }];
  }

  return [];
}

/* ✅ Public navigation */
const PUBLIC_NAV: NavItem[] = [
  { label: "Forside", href: "/" },
  { label: "Hvordan", href: "/hvordan" },
  { label: "Lunsjordning", href: "/lunsjordning" },
  { label: "Alternativ til kantine", href: "/alternativ-til-kantine" },
];

/* =========================================================
   Root Layout
========================================================= */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = await resolvePathname();

  const authRoute = pathname ? isAuthPath(pathname) : false;
  const adminRoute = pathname ? isAdminPath(pathname) : false;
  const adminNav = adminRoute ? navForAdmin(pathname) : [];

  return (
    <html lang="no" className={`${fontBody.variable} ${fontDisplay.variable} ${fontHeading.variable} h-full`}>
      <body className="min-h-full antialiased">
        {process.env.NODE_ENV !== "production" ? <DevOverflowGuard /> : null}

        {/* ✅ Auth pages: no header/footer */}
        {authRoute ? (
          children
        ) : (
          <div className="lp-page">
            {/* ✅ Header selection */}
            {adminRoute ? (
              <AdminHeader nav={adminNav} title={isSuperadminPath(pathname) ? "Superadmin" : "Admin"} />
            ) : (
              <PublicHeader
                nav={PUBLIC_NAV}
                rightSlot={
                  <>
                    <span className="hidden sm:inline-flex rounded-full border border-[rgb(var(--lp-border))] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[rgb(var(--lp-text))]">
                      Ikke innlogget
                    </span>
                    <Link href="/login" className="lp-btn lp-btn-ghost lp-btn--sm">
                      Til login
                    </Link>
                  </>
                }
              />
            )}

            <main className="lp-main">
              <div className="w-full">{children}</div>
            </main>

            <AppFooter containerMode="full" />
          </div>
        )}
      </body>
    </html>
  );
}
