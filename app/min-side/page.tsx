// app/min-side/page.tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getScope, ScopeError } from "@/lib/auth/scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

/**
 * Min side er kun en smart redirect:
 * - Ikke innlogget            → /login?next=/week
 * - Innlogget, men ikke aktiv → /status
 * - Aktiv bruker              → /week
 *
 * Ingen UI rendres her med vilje.
 */
export default async function MinSidePage() {
  try {
    // Bruk samme sannhetskilde som API og admin/UI
    const scope = await getScope({ headers: headers() } as any);

    // Konto og firma er aktiv → ansattvisning
    redirect("/week");
  } catch (e: any) {
    if (e instanceof ScopeError) {
      // Ikke innlogget
      if (e.code === "UNAUTHENTICATED") {
        redirect("/login?next=/week");
      }

      // Registrert, men ikke aktiv / firma ikke aktivt
      if (
        e.code === "ACCOUNT_INACTIVE" ||
        e.code === "COMPANY_NOT_ACTIVE" ||
        e.code === "COMPANY_MISSING"
      ) {
        redirect("/status?state=pending&next=/week");
      }
    }

    // Fallback → status (sikker standard)
    redirect("/status");
  }
}
