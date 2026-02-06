// components/layout/AppChrome.tsx
import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import AuthStatus from "@/components/auth/AuthStatus";

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/register" ||
    pathname.startsWith("/register/") ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/forgot-password/") ||
    pathname === "/reset-password" ||
    pathname.startsWith("/reset-password/")
  );
}

export default async function AppChrome({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const pathname = h.get("x-pathname") || ""; // fallback hvis matcher/host ikke setter

  // Hvis vi ikke får pathname her: rendér alltid chrome (safe)
  const hideChrome = pathname ? isPublicPath(pathname) : false;

  if (hideChrome) {
    return <>{children}</>;
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-bg))]/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 md:h-16 md:gap-4">
          <Link href="/" className="flex items-center">
            <Image
              src="/brand/LP-logo-uten-bakgrunn.png"
              alt="Lunchportalen"
              width={160}
              height={32}
              sizes="(max-width: 768px) 120px, 160px"
              priority
              className="h-6 w-auto max-h-8 object-contain md:h-8"
            />
          </Link>

          <nav className="flex flex-nowrap items-center gap-3">
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
  );
}
