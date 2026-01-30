// app/layout.tsx
import "./globals.css";

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";

import AuthStatus from "@/components/auth/AuthStatus";
import SuperadminTopNavInline from "@/components/superadmin/SuperadminTopNavInline";

/* =========================================================
   Fonts
========================================================= */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/* =========================================================
   Metadata
========================================================= */
export const metadata: Metadata = {
  title: {
    default: "Lunchportalen – firmalunsj med kontroll",
    template: "%s | Lunchportalen",
  },
  description:
    "Lunchportalen er en digital lunsjløsning for bedrifter: dere setter rammene, ansatte bestiller selv innenfor avtalen, med cut-off kl. 08:00. Mindre matsvinn, mindre administrasjon, full oversikt.",
  applicationName: "Lunchportalen",
  metadataBase: new URL("https://lunchportalen.no"),
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "Lunchportalen",
    title: "Lunchportalen – firmalunsj med kontroll",
    description:
      "Mindre matsvinn. Mindre administrasjon. Full forutsigbarhet. En lunsjløsning utviklet for bedrifter.",
    url: "https://lunchportalen.no",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lunchportalen – firmalunsj med kontroll",
    description: "Firmalunsj med kontroll, mindre svinn og forutsigbarhet – cut-off kl. 08:00.",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

/* =========================================================
   Helpers
========================================================= */
function cleanPath(pathname: string) {
  return (pathname || "").split("?")[0];
}

function isPublicPath(pathname: string) {
  const p = cleanPath(pathname);

  return (
    p === "/" || // ✅ Landing er offentlig
    p === "/login" ||
    p.startsWith("/login/") ||
    p === "/register" ||
    p.startsWith("/register/") ||
    p === "/registrering" ||
    p.startsWith("/registrering/") ||
    p === "/onboarding" ||
    p.startsWith("/onboarding/") ||
    p === "/forgot-password" ||
    p.startsWith("/forgot-password/")
  );
}

/** ✅ Sider der ansatte oftest misforstår */
function isRegistrationFlow(pathname: string) {
  const p = cleanPath(pathname);
  return (
    p === "/register" ||
    p.startsWith("/register/") ||
    p === "/registrering" ||
    p.startsWith("/registrering/") ||
    p === "/onboarding" ||
    p.startsWith("/onboarding/")
  );
}

/** ✅ “Fokusmodus” – skjul toppmeny for å unngå forvirring */
function isFocusMode(pathname: string) {
  const p = cleanPath(pathname);
  return (
    p === "/login" ||
    p.startsWith("/login/") ||
    p === "/forgot-password" ||
    p.startsWith("/forgot-password/") ||
    isRegistrationFlow(p) // ✅ inkluder registrering/onboarding
  );
}

function getPathnameFromHeaders(h: Headers): string {
  // Prefer middleware-provided pathname if present
  const fromMiddleware = h.get("x-pathname");
  if (fromMiddleware) return fromMiddleware;

  // Some setups provide next-url
  const nextUrl = h.get("next-url");
  if (nextUrl) {
    try {
      if (nextUrl.startsWith("http")) return new URL(nextUrl).pathname;
      return nextUrl.split("?")[0];
    } catch {
      return nextUrl.split("?")[0];
    }
  }

  // Try x-url / x-forwarded-uri / x-original-url (variasjoner)
  const xurl = h.get("x-url") || h.get("x-forwarded-uri") || h.get("x-original-url") || "";
  if (xurl) {
    try {
      const u = xurl.startsWith("http") ? new URL(xurl) : new URL(xurl, "http://local");
      return u.pathname;
    } catch {
      return xurl.split("?")[0];
    }
  }

  // Last resort: referer
  const ref = h.get("referer");
  if (ref) {
    try {
      return new URL(ref).pathname;
    } catch {
      return "";
    }
  }

  return "";
}

function EmployeeMisunderstandingBanner() {
  // Server-komponent, enkel og trygg.
  return (
    <div className="border-b border-[rgb(var(--lp-border))] bg-white/70">
      <div className="mx-auto max-w-3xl px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[rgb(var(--lp-text))]">
            <strong>Viktig:</strong> Denne registreringen er kun for <strong>firma-admin</strong> (leder/ansvarlig).
            <span className="text-[rgb(var(--lp-muted))]"> Ansatte får tilgang via invitasjon.</span>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-1 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-white/80"
          >
            Jeg er ansatt – gå til innlogging
          </Link>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Root layout
========================================================= */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // ✅ Your Next version: headers() is async
  const h = await headers();
  const pathname = getPathnameFromHeaders(h);

  const focusMode = pathname ? isFocusMode(pathname) : false;
  const showRegBanner = pathname ? isRegistrationFlow(pathname) : false;

  // NOTE: isPublicPath is kept for future gating, not used directly here.
  // const isPublic = pathname ? isPublicPath(pathname) : false;

  return (
    <html lang="no" className={`${geistSans.variable} ${geistMono.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full bg-[rgb(var(--lp-bg))] text-[rgb(var(--lp-text))] antialiased">
        {focusMode ? (
          <>
            {/* ✅ “Idiotsikker” ansatt-beskjed på registrering/onboarding */}
            {showRegBanner ? <EmployeeMisunderstandingBanner /> : null}

            {/* ✅ Fokusmodus får fortsatt en ren, sentrert container */}
            <main className="min-h-[calc(100vh-1px)]">
              <div className="mx-auto w-full max-w-3xl px-4 py-8">{children}</div>
            </main>

            <footer className="border-t border-[rgb(var(--lp-border))] bg-white/40">
              <div className="mx-auto max-w-3xl px-4 py-6 text-xs text-[rgb(var(--lp-muted))]">
                © {new Date().getFullYear()} Lunchportalen
              </div>
            </footer>
          </>
        ) : (
          <>
            {/* ✅ Global header */}
            <header className="sticky top-0 z-50 border-b border-[rgb(var(--lp-border))] bg-white/75 backdrop-blur">
              <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 md:h-16 md:gap-4">
                <div className="flex items-center gap-4">
                  <Link href="/" className="flex items-center">
                    <Image
                      src="/LunchPortalen_Enterprise_Logo_Pack/LP-logo-uten-bakgrunn.png"
                      alt="Lunchportalen"
                      width={220}
                      height={44}
                      priority
                      className="h-auto w-[170px] md:w-[210px]"
                    />
                    <span className="sr-only">Lunchportalen</span>
                  </Link>

                  {/* ✅ Primary nav (diskret) */}
                  <nav className="hidden items-center gap-1 text-sm md:flex">
                    <Link
                      href="/week"
                      className="rounded-lg px-3 py-2 text-[rgb(var(--lp-muted))] hover:bg-black/5 hover:text-[rgb(var(--lp-text))]"
                    >
                      Uke
                    </Link>
                    <Link
                      href="/kitchen"
                      className="rounded-lg px-3 py-2 text-[rgb(var(--lp-muted))] hover:bg-black/5 hover:text-[rgb(var(--lp-text))]"
                    >
                      Kjøkken
                    </Link>
                    <Link
                      href="/driver"
                      className="rounded-lg px-3 py-2 text-[rgb(var(--lp-muted))] hover:bg-black/5 hover:text-[rgb(var(--lp-text))]"
                    >
                      Sjåfør
                    </Link>
                    <Link
                      href="/admin"
                      className="rounded-lg px-3 py-2 text-[rgb(var(--lp-muted))] hover:bg-black/5 hover:text-[rgb(var(--lp-text))]"
                    >
                      Admin
                    </Link>
                  </nav>
                </div>

                <nav className="flex items-center gap-3">
                  {/* ✅ Kun synlig på /superadmin* og ligger ved siden av AuthStatus */}
                  <SuperadminTopNavInline />
                  {/* ✅ Innlogget label + Logg ut */}
                  <AuthStatus />
                </nav>
              </div>
            </header>

            {/* ✅ AppShell body */}
            <main className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)]">
              <div className="mx-auto w-full max-w-6xl px-4 py-8">{children}</div>
            </main>

            <footer className="border-t border-[rgb(var(--lp-border))] bg-white/40">
              <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-[rgb(var(--lp-muted))]">
                © {new Date().getFullYear()} Lunchportalen
              </div>
            </footer>
          </>
        )}
      </body>
    </html>
  );
}
