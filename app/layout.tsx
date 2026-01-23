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
    description:
      "Firmalunsj med kontroll, mindre svinn og forutsigbarhet – cut-off kl. 08:00.",
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
  const fromMiddleware = h.get("x-pathname");
  if (fromMiddleware) return fromMiddleware;

  const nextUrl = h.get("next-url");
  if (nextUrl) {
    try {
      if (nextUrl.startsWith("http")) return new URL(nextUrl).pathname;
      return nextUrl.split("?")[0];
    } catch {
      return nextUrl.split("?")[0];
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
            <strong>Viktig:</strong> Denne registreringen er kun for{" "}
            <strong>firma-admin</strong> (leder/ansvarlig).
            <span className="text-[rgb(var(--lp-muted))]">
              {" "}
              Ansatte får tilgang via invitasjon.
            </span>
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
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const pathname = getPathnameFromHeaders(h);

  const focusMode = pathname ? isFocusMode(pathname) : false;
  const showRegBanner = pathname ? isRegistrationFlow(pathname) : false;

  return (
    <html
      lang="no"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-[rgb(var(--lp-bg))] text-[rgb(var(--lp-text))] antialiased">
        {focusMode ? (
          <>
            {/* ✅ “Idiotsikker” ansatt-beskjed på registrering/onboarding */}
            {showRegBanner ? <EmployeeMisunderstandingBanner /> : null}
            <main>{children}</main>
          </>
        ) : (
          <>
            {/* ✅ EN header (global). Superadmin-knapper ligger i samme rad ved siden av Logg ut */}
            <header className="sticky top-0 z-50 border-b border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-bg))]/80 backdrop-blur">
              <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 md:h-16 md:gap-4">
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

                <nav className="flex items-center gap-3">
                  {/* ✅ Kun synlig på /superadmin* og ligger ved siden av AuthStatus */}
                  <SuperadminTopNavInline />

                  {/* ✅ Innlogget label er klikkbar + Logg ut */}
                  <AuthStatus />
                </nav>
              </div>
            </header>

            <main>{children}</main>

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
