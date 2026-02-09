// app/week/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { headers } from "next/headers";

import WeekClient from "./WeekClient";
import PageSection from "@/components/layout/PageSection";
import { getScope, ScopeError } from "@/lib/auth/scope";

/**
 * Week (ansattvisning) — enterprise routing-fasit:
 * - Ikke innlogget                 -> /login?next=/week
 * - Konto inaktiv / firma ikke aktiv -> /status?state=pending&next=/week
 * - Superadmin/kitchen/driver      -> egne flater
 * - Company admin                  -> /admin
 * - Employee uten company/location -> forklaringsside
 * - Employee OK                    -> WeekClient
 *
 * Viktig:
 * - Vi bruker getScope() som sannhetskilde (samme som API),
 *   så pending/inactive stoppes konsistent overalt.
 * - Ingen DB-queries i middleware; dette er server-side page guard.
 */

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

export default async function Page() {
  let scope: Awaited<ReturnType<typeof getScope>>;

  try {
    scope = await getScope({ headers: headers() } as any);
  } catch (e: any) {
    if (e instanceof ScopeError) {
      // Ikke innlogget -> login
      if (e.code === "UNAUTHENTICATED") {
        redirect("/login?next=/week");
      }

      // Registrert men ikke aktiv / firma ikke aktiv -> status (venterom)
      if (
        e.code === "ACCOUNT_INACTIVE" ||
        e.code === "COMPANY_NOT_ACTIVE" ||
        e.code === "COMPANY_MISSING"
      ) {
        redirect("/status?state=pending&next=/week");
      }
    }

    // Fallback
    redirect("/status?state=paused&next=/week");
  }

  const role = scope.role as Role;

  // Absolutt routing (systemroller)
  if (role === "superadmin") redirect("/superadmin");
  if (role === "kitchen") redirect("/kitchen");
  if (role === "driver") redirect("/driver");
  if (role === "company_admin") redirect("/admin");

  // Employee: krever firmatilknytning + lokasjon
  if (!scope.company_id || !scope.location_id) {
    return (
      <PageSection
        title="Mangler firmatilknytning"
        subtitle="Kontoen din er ikke knyttet til et firma eller en lokasjon. Ta kontakt med firmaets administrator."
      />
    );
  }

  // Alt OK → Week UI
  return (
    <PageSection
      title="Planlegg lunsj"
      subtitle={
        <>
          Endringer låses kl.{" "}
          <span className="font-medium text-text">08:00</span> samme dag.
        </>
      }
    >
      <WeekClient />
    </PageSection>
  );
}
