// app/min-side/page.tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { homeForRole } from "@/lib/auth/redirect";
import { getScope, ScopeError } from "@/lib/auth/scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Min side er kun en smart redirect:
 * - Ikke innlogget            → /login?next=/week (kanonisk employee-flate)
 * - Innlogget, men ikke aktiv → /status
 * - Aktiv bruker              → rolle-hjem (employee → /week)
 *
 * Ingen UI rendres her med vilje.
 */
export default async function MinSidePage() {
  try {
    const scope = await getScope({ headers: headers() } as any);
    // Eksplisitt: ansatt skal aldri «lande» på /min-side — samme mål som (app)-layout (/week).
    if (scope.role === "employee") {
      redirect("/week");
    }
    redirect(homeForRole(scope.role));
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
