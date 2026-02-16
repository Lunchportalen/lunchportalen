// app/kitchen/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { redirect } from "next/navigation";

import KitchenView from "./KitchenView";
import PageSection from "@/components/layout/PageSection";
import BlockedState from "@/components/admin/BlockedState";

import { supabaseServer } from "@/lib/supabase/server";
import { systemRoleByEmail } from "@/lib/system/emails";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

/* =========================================================
   Helpers (enterprise-safe)
========================================================= */

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * 🔒 NO-EXCEPTION RULE:
 * - Hard system-e-poster er fasit
 * - Deretter profiles.role (server truth)
 */
function roleByEmail(email: string | null | undefined): Role | null {
  return systemRoleByEmail(email);
}

function normalizeRole(v: unknown): Role {
  const s = safeStr(v).toLowerCase();

  if (s === "company_admin" || s === "companyadmin" || s === "admin") return "company_admin";
  if (s === "superadmin" || s === "root") return "superadmin";
  if (s === "kitchen") return "kitchen";
  if (s === "driver") return "driver";

  return "employee";
}

function allowKitchenOrSuperadmin(role: Role) {
  return role === "kitchen" || role === "superadmin";
}

function loginNext(urlPath: string, code: string) {
  return `/login?next=${encodeURIComponent(urlPath)}&code=${encodeURIComponent(code)}`;
}

/* =========================================================
   Page
========================================================= */

export default async function Page() {
  const supabase = await supabaseServer();

  /* =========================
     🔐 AUTH GATE (hard)
  ========================= */
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) {
    redirect(loginNext("/kitchen", "NO_SESSION"));
  }

  /* =========================
     🔐 ROLE GATE (Hard email først, deretter profiles.role)
     FASET:
     - profiles.id = auth.users.id (primary)
     - fallback: profiles.user_id = auth.users.id (legacy)
  ========================= */
  const { data: profile, error: pErr } = (await supabase
    .from("profiles")
    .select("role, disabled_at, is_active, company_id, location_id")
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .maybeSingle()) as {
    data: {
      role: string | null;
      disabled_at: string | null;
      is_active: boolean | null;
      company_id: string | null;
      location_id: string | null;
    } | null;
    error: any;
  };

  // Fail-closed: hvis vi ikke får profil => ut
  if (pErr || !profile) {
    redirect(loginNext("/kitchen", "NO_PROFILE"));
  }

  // Disabled gate (fail-closed)
  if (profile.disabled_at) {
    redirect(loginNext("/kitchen", "DISABLED"));
  }
  if (profile.is_active === false) {
    redirect(loginNext("/kitchen", "INACTIVE"));
  }

  const emailRole = roleByEmail(user.email);
  const role: Role = emailRole ?? normalizeRole(profile.role);

  // Final allow
  if (!allowKitchenOrSuperadmin(role)) {
    redirect("/week");
  }

  if (role === "kitchen" && (!safeStr(profile.company_id) || !safeStr(profile.location_id))) {
    return (
      <PageSection title="Kjøkken" subtitle="Tilgang er blokkert inntil scope er korrekt tildelt.">
        <BlockedState
          level="critical"
          title="Scope mangler"
          body="Kjøkken-rollen er tenant-bound og krever både firma og lokasjon."
          nextSteps={[
            "Tildel company_id og location_id på brukerprofilen.",
            "Verifiser tilgang via API og RLS før ny innlogging.",
          ]}
          meta={[
            { label: "code", value: "SCOPE_NOT_ASSIGNED" },
            { label: "role", value: role },
            { label: "company_id", value: safeStr(profile.company_id) || "null" },
            { label: "location_id", value: safeStr(profile.location_id) || "null" },
          ]}
        />
      </PageSection>
    );
  }

  /* =========================
     ✅ PAGE
  ========================= */
  return (
    <>
      {/* Screen header (not printed) */}
      <div className="print:hidden">
        <PageSection
          title="Kjøkken"
          subtitle="Dagens produksjonsliste. Ordrene er gruppert per leveringsvindu, firma og lokasjon. Dette er fasit."
          right={
            <aside className="hidden w-full max-w-sm rounded-2xl bg-white px-4 py-3 text-xs text-[rgb(var(--lp-muted))] ring-1 ring-[rgb(var(--lp-border))] md:block">
              <div className="font-semibold text-slate-900">Driftsnotat</div>
              <ul className="mt-2 space-y-1">
                <li>Dato følger Oslo-tid.</li>
                <li>Utskrift: bruk nettleserens print.</li>
                <li>Endringer etter cut-off registreres som avvik.</li>
              </ul>
            </aside>
          }
        />
      </div>

      {/* Print header */}
      <div className="mb-4 hidden print:block">
        <div className="text-xl font-semibold">Kjøkken – produksjonsliste</div>
        <div className="text-xs text-slate-600">Generert fra Lunchportalen</div>
      </div>

      <div className="mt-6 print:mt-0">
        <KitchenView />
      </div>
    </>
  );
}
