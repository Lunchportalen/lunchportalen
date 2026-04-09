// app/orders/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { requireActiveAgreement } from "@/lib/agreements/requireActiveAgreement";
import { homeForRole, type Role } from "@/lib/auth/roles";
import { getScope, ScopeError } from "@/lib/auth/scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Bestillinger | Lunchportalen",
};

function isAgreementScopeCode(code: string) {
  const normalized = String(code ?? "").trim().toUpperCase();
  return normalized.startsWith("AGREEMENT_");
}

function isKnownRole(role: string): role is Role {
  return role === "employee" || role === "company_admin" || role === "superadmin" || role === "kitchen" || role === "driver";
}

export default async function OrdersPage() {
  let shouldGateByAgreement = false;

  try {
    // getScope trenger NextRequest i API,
    // men i Server Components bruker den headers() internt via cookies
    // (scope.ts er bygget for dette mønsteret)
    const scope = await getScope({ headers: headers() } as any);
    const role = String((scope as any)?.role ?? "").trim().toLowerCase();
    if (role === "employee") {
      redirect("/week");
    }
    if (role !== "employee") {
      if (isKnownRole(role)) {
        redirect(homeForRole(role));
      }
      redirect("/");
    }

    shouldGateByAgreement = true;
  } catch (e: any) {
    if (e instanceof ScopeError) {
      // Ikke innlogget -> login
      if (e.code === "UNAUTHENTICATED") {
        redirect("/login?next=/week");
      }

      // Pending / inactive / paused / closed -> status
      if (e.code === "ACCOUNT_INACTIVE" || e.code === "COMPANY_NOT_ACTIVE" || e.code === "COMPANY_MISSING") {
        redirect("/status");
      }

      // For agreement-feil bruker vi canonical agreement-gate under.
      if (isAgreementScopeCode(e.code)) {
        shouldGateByAgreement = true;
      } else {
        // Fallback: alt annet -> status
        redirect("/status");
      }
    } else {
      // Ukjent feil -> status
      redirect("/status");
    }
  }

  if (shouldGateByAgreement) {
    await requireActiveAgreement();
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Bestillinger</h1>
      <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Denne siden er under oppsett.</p>
    </main>
  );
}
