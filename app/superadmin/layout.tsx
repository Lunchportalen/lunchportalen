// app/superadmin/layout.tsx
import type { ReactNode } from "react";
import { headers } from "next/headers";
import Link from "next/link";

import AuthStatus from "@/components/auth/AuthStatus";
import SuperadminHeader from "@/components/superadmin/SuperadminHeader";
import SuperadminNav from "@/components/superadmin/SuperadminNav";

/**
 * Superadmin layout:
 * - Toppheader (SuperadminHeader)
 * - Sekundær navigasjon (Dashboard / Audit) via client-komponent
 * - Standard bredde + luft + trygg bakgrunn
 * - AuthStatus synlig
 *
 * NB: Access control (redirect for ikke-superadmin) håndteres i middleware.
 * Denne layouten er kun UI-ramme.
 */
export default function SuperadminLayout({ children }: { children: ReactNode }) {
  // Hindrer uønsket caching av layout når auth/cookies påvirker visning
  headers();

  return (
    <div className="min-h-dvh bg-[rgb(var(--lp-bg))] text-[rgb(var(--lp-fg))]">
      {/* Global superadmin header */}
      <SuperadminHeader />

      <div className="mx-auto w-full max-w-7xl px-4">
        {/* Top row: breadcrumb + auth */}
        <div className="py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-[rgb(var(--lp-muted))]">
            <Link
              href="/superadmin"
              className="inline-flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 ring-1 ring-[rgb(var(--lp-border))] hover:bg-white transition font-semibold"
            >
              Superadmin
            </Link>
            <span className="hidden sm:inline">/</span>
            <span className="hidden sm:inline">Kontrollsenter</span>
          </div>

          <div className="flex items-center gap-2">
            <AuthStatus />
          </div>
        </div>

        {/* Secondary nav (client – kan bruke usePathname) */}
        <SuperadminNav />

        {/* Page content */}
        <main className="pb-10">{children}</main>
      </div>
    </div>
  );
}
