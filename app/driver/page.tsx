// app/driver/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import "server-only";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import DriverClient from "./DriverClient";
import PageSection from "@/components/layout/PageSection";
import BlockedState from "@/components/admin/BlockedState";
import { systemRoleByEmail } from "@/lib/system/emails";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type ProfileRow = {
  role: Role | string | null;
  disabled_at: string | null;
  is_active?: boolean | null;
  company_id?: string | null;
  location_id?: string | null;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * Hard role override (kun for systemkonti).
 * NB: Dette er "first match" før profiles, slik at systembrukere alltid kommer inn.
 */
function roleByEmail(email: string | null | undefined): Role | null {
  return systemRoleByEmail(email);
}

function normalizeRole(v: unknown): Role {
  const s = safeStr(v).toLowerCase();
  if (s === "company_admin" || s === "companyadmin" || s === "admin") return "company_admin";
  if (s === "superadmin" || s === "root") return "superadmin";
  if (s === "kitchen" || s === "kjokken") return "kitchen";
  if (s === "driver" || s === "sjafor") return "driver";
  return "employee";
}

function loginNext(urlPath: string) {
  return `/login?next=${encodeURIComponent(urlPath)}&code=NO_SESSION`;
}

export default async function DriverPage() {
  const supabase = await supabaseServer();

  /* =========================
     🔐 AUTH
  ========================= */
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) {
    redirect(loginNext("/driver"));
  }

  /* =========================
     🔐 ROLE (email hard first, then profiles)
     FASET:
     - profiles.id = auth.users.id (primary)
     - fallback: profiles.user_id = auth.users.id (legacy)
  ========================= */
  const { data: profile, error: pErr } = (await supabase
    .from("profiles")
    .select("role, disabled_at, is_active, company_id, location_id")
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .maybeSingle()) as { data: ProfileRow | null; error: any };

  // Fail-closed: hvis vi ikke klarer å lese profilen => ut
  if (pErr || !profile) redirect(loginNext("/driver"));

  // Deaktiverte kontoer skal ikke inn
  if (profile.disabled_at) redirect(loginNext("/driver"));
  if (profile.is_active === false) redirect(loginNext("/driver"));

  const emailRole = roleByEmail(user.email);
  const role: Role = emailRole ?? normalizeRole(profile.role);

  // Kun driver og superadmin
  if (role !== "driver" && role !== "superadmin") {
    redirect("/week");
  }

  if (role === "driver" && (!safeStr(profile.company_id) || !safeStr(profile.location_id))) {
    return (
      <PageSection title="Sjåfør" subtitle="Tilgang er blokkert inntil scope er korrekt tildelt.">
        <BlockedState
          level="critical"
          title="Scope mangler"
          body="Sjåfør-rollen er tenant-bound og krever både firma og lokasjon."
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
      <div className="print:hidden">
        <PageSection
          title="Sjåfør"
          subtitle="Dagens leveringer er gruppert per tidsvindu, firma og lokasjon. Dette er fasit."
          right={
            <aside className="hidden w-full max-w-sm rounded-2xl bg-white px-4 py-3 text-xs text-[rgb(var(--lp-muted))] ring-1 ring-[rgb(var(--lp-border))] md:block">
              <div className="font-semibold text-slate-900">Driftsnotat</div>
              <ul className="mt-2 space-y-1">
                <li>Dagens stopp følger Oslo-tid.</li>
                <li>Følg tidsvinduene for hver lokasjon.</li>
                <li>Eventuelle avvik registreres etter levering.</li>
              </ul>
            </aside>
          }
        >
          <div className="flex flex-wrap gap-2 text-xs text-[rgb(var(--lp-muted))]">
            <span className="rounded-full bg-black/5 px-3 py-1">🚚 Dagens stopp</span>
            <span className="rounded-full bg-black/5 px-3 py-1">🗺️ Lokasjoner</span>
            <span className="rounded-full bg-black/5 px-3 py-1">☎️ Kontakt</span>
          </div>
        </PageSection>
      </div>

      <div className="mb-4 hidden print:block">
        <div className="text-xl font-semibold">Sjåfør – leveranser</div>
        <div className="text-xs text-slate-600">Generert fra Lunchportalen</div>
      </div>

      <div className="mt-6 print:mt-0">
        <DriverClient />
      </div>
    </>
  );
}
