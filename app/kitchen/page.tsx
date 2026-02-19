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

function renderBlocked(subtitle: string, title: string, body: string, nextSteps: string[], meta: Array<{ label: string; value: string }>) {
  return (
    <PageSection title="Kjøkken" subtitle={subtitle}>
      <BlockedState level="critical" title={title} body={body} nextSteps={nextSteps} meta={meta} />
    </PageSection>
  );
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
  const companyId = safeStr(profile.company_id);
  const locationId = safeStr(profile.location_id);

  if (!allowKitchenOrSuperadmin(role)) {
    return renderBlocked(
      "Du har ikke tilgang til kjøkkenvisningen.",
      "Ingen tilgang",
      "Siden er kun tilgjengelig for kjøkken og superadmin.",
      ["Logg inn med en bruker som har riktig rolle."],
      [
        { label: "rolle", value: role },
        { label: "kode", value: "FORBIDDEN" },
      ]
    );
  }

  if (role === "kitchen" && !companyId) {
    return renderBlocked(
      "Brukeren er ikke koblet til et firma.",
      "Firma mangler",
      "Kjøkkenvisning krever at brukeren er koblet til et firma.",
      ["Koble brukeren til riktig firma.", "Prøv innlogging på nytt."],
      [
        { label: "rolle", value: role },
        { label: "kode", value: "COMPANY_MISSING" },
      ]
    );
  }

  if (role === "kitchen" && !locationId) {
    return renderBlocked(
      "Brukeren er ikke koblet til et sted.",
      "Sted mangler",
      "Kjøkkenvisning krever at brukeren er koblet til et sted.",
      ["Koble brukeren til riktig sted.", "Prøv innlogging på nytt."],
      [
        { label: "rolle", value: role },
        { label: "kode", value: "LOCATION_MISSING" },
      ]
    );
  }

  if (role === "kitchen") {
    const { data: agreementRows, error: agreementErr } = await supabase
      .from("agreements")
      .select("id")
      .eq("company_id", companyId)
      .in("status", ["ACTIVE", "active"])
      .limit(1);

    const hasActiveAgreement = !agreementErr && Array.isArray(agreementRows) && agreementRows.length > 0;
    if (!hasActiveAgreement) {
      return renderBlocked(
        "Kjøkkenvisning er ikke tilgjengelig før firmaet har aktiv avtale.",
        "Aktiv avtale mangler",
        "Firmaet må ha aktiv avtale før kjøkkenlisten kan åpnes.",
        ["Aktiver en avtale for firmaet.", "Prøv siden på nytt."],
        [
          { label: "rolle", value: role },
          { label: "firma", value: companyId || "mangler" },
          { label: "kode", value: "MISSING_CONTRACT" },
        ]
      );
    }
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
