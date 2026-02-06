import "./globals.css";

import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Manrope } from "next/font/google";
import { headers } from "next/headers";
import AppHeader from "@/components/AppHeader";
import DevOverflowGuard from "@/components/DevOverflowGuard";

const fontBody = Manrope({ subsets: ["latin"], variable: "--lp-font-body", display: "swap" });
const fontDisplay = Fraunces({ subsets: ["latin"], variable: "--lp-font-display", display: "swap" });
const fontHeading = Inter({ subsets: ["latin"], variable: "--lp-font-heading", display: "swap", weight: ["600", "700"] });

export const metadata: Metadata = {
  title: {
    default: "Lunchportalen",
    template: "%s | Lunchportalen",
  },
  description: "Enterprise lunch portal.",
  applicationName: "Lunchportalen",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

async function resolvePathname() {
  const h = await headers();
  const pathname = h.get("x-pathname");
  if (pathname) return pathname;

  const nextUrl = h.get("next-url") || "";
  if (nextUrl) {
    try {
      const url = nextUrl.startsWith("http") ? new URL(nextUrl) : new URL(nextUrl, "http://local");
      return url.pathname;
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
    const url = raw.startsWith("http") ? new URL(raw) : new URL(raw, "http://local");
    return url.pathname;
  } catch {
    return "";
  }
}

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = await resolvePathname();
  const authRoute = pathname ? isAuthPath(pathname) : false;
  const isAdminArea = pathname ? pathname.startsWith("/admin") || pathname.startsWith("/superadmin") : false;

  const areaLabel = (() => {
    if (!pathname) return "Lunchportalen";
    if (pathname.startsWith("/week") || pathname.startsWith("/orders") || pathname.startsWith("/min-side")) return "Ansatt";
    if (pathname.startsWith("/kitchen") || pathname.startsWith("/kjokken")) return "Kjøkken";
    if (pathname.startsWith("/driver")) return "Sjåfør";
    if (pathname.startsWith("/system")) return "System";
    return "Lunchportalen";
  })();

  const nav = (() => {
    if (!pathname) return [];
    if (pathname.startsWith("/kitchen") || pathname.startsWith("/kjokken")) {
      return [{ label: "Rapport", href: "/kitchen" }];
    }
    if (pathname.startsWith("/driver")) {
      return [{ label: "Ruter", href: "/driver" }];
    }
    if (pathname.startsWith("/system")) {
      return [{ label: "Status", href: "/system" }];
    }
    return [
      { label: "Ukeplan", href: "/week" },
      { label: "Bestillinger", href: "/orders" },
      { label: "Min side", href: "/min-side" },
    ];
  })();

  return (
    <html lang="no" className={`${fontBody.variable} ${fontDisplay.variable} ${fontHeading.variable} h-full`}>
      <body className="min-h-full">
        {process.env.NODE_ENV !== "production" ? <DevOverflowGuard /> : null}
        {authRoute ? (
          children
        ) : (
          <div className="lp-page">
            {!isAdminArea ? <AppHeader areaLabel={areaLabel} nav={nav} /> : null}
            <main className="lp-main">
              <div className="lp-container">{children}</div>
            </main>
          </div>
        )}
      </body>
    </html>
  );
}
