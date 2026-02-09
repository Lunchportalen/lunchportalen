// app/orders/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getScope, ScopeError } from "@/lib/auth/scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Bestillinger | Lunchportalen",
};

export default async function OrdersPage() {
  /**
   * UI-gate (FASIT):
   * - API er allerede beskyttet via scope/routeGuard
   * - UI skal aldri rendres for:
   *   - ikke innlogget
   *   - konto inaktiv
   *   - firma ≠ active
   *
   * Resultat:
   * - Redirect til /login eller /status (venterom)
   */

  try {
    // getScope trenger NextRequest i API,
    // men i Server Components bruker den headers() internt via cookies
    // (scope.ts er bygget for dette mønsteret)
    await getScope({ headers: headers() } as any);
  } catch (e: any) {
    if (e instanceof ScopeError) {
      // Ikke innlogget → login
      if (e.code === "UNAUTHENTICATED") {
        redirect("/login?next=/orders");
      }

      // Pending / inactive / paused / closed → status
      if (
        e.code === "ACCOUNT_INACTIVE" ||
        e.code === "COMPANY_NOT_ACTIVE" ||
        e.code === "COMPANY_MISSING"
      ) {
        redirect("/status");
      }

      // Fallback: alt annet → status
      redirect("/status");
    }

    // Ukjent feil → status
    redirect("/status");
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Bestillinger</h1>
      <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
        Denne siden er under oppsett.
      </p>
    </main>
  );
}
