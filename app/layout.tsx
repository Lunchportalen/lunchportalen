// app/layout.tsx
import "./globals.css";

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";

import AuthStatus from "@/components/auth/AuthStatus";

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

function isPublicPath(pathname: string) {
  const p = (pathname || "").split("?")[0];

  return (
    p === "/login" ||
    p.startsWith("/login/") ||
    p === "/register" ||
    p.startsWith("/register/") ||
    p === "/forgot-password" ||
    p.startsWith("/forgot-password/")
  );
}

function getPathnameFromHeaders(h: Headers): string {
  // 1) Prefer vår egen header fra middleware
  const fromMiddleware = h.get("x-pathname");
  if (fromMiddleware) return fromMiddleware;

  // 2) Fallback: Next kan gi next-url i noen miljø (inneholder path+query)
  const nextUrl = h.get("next-url");
  if (nextUrl) {
    try {
      if (nextUrl.startsWith("http")) return new URL(nextUrl).pathname;
      return nextUrl.split("?")[0];
    } catch {
      return nextUrl.split("?")[0];
    }
  }

  // 3) Ikke bruk referer (kan feil-klassifisere /week etter login)
  // Fail-open: returner tom streng -> chrome vises.
  return "";
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();

  const pathname = getPathnameFromHeaders(h);

  // ✅ Fail-open: hvis vi ikke vet path, viser vi chrome (tryggest).
  const hideChrome = pathname ? isPublicPath(pathname) : false;

  return (
    <html
      lang="no"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-[rgb(var(--lp-bg))] text-[rgb(var(--lp-text))] antialiased">
        {hideChrome ? (
          <main>{children}</main>
        ) : (
          <>
            {/* ===== Header ===== */}
            <header className="sticky top-0 z-50 border-b border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-bg))]/80 backdrop-blur">
              <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 md:h-16 md:gap-4">
                {/* Logo */}
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

                {/* Actions (auth-aware) */}
                <nav className="flex flex-nowrap items-center gap-3">
                  <AuthStatus />
                </nav>
              </div>
            </header>

            {/* ===== Page content ===== */}
            <main>{children}</main>

            {/* ===== Footer ===== */}
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
