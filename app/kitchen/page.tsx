// app/kitchen/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import KitchenView from "./KitchenView";
import { supabaseServer } from "@/lib/supabase/server";
import PageSection from "@/components/layout/PageSection";
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
  if (s === "superadmin") return "superadmin";
  if (s === "kitchen") return "kitchen";
  if (s === "driver") return "driver";

  return "employee";
}

function allowKitchenOrSuperadmin(role: Role) {
  return role === "kitchen" || role === "superadmin";
}

function loginNext(urlPath: string) {
  return `/login?next=${encodeURIComponent(urlPath)}`;
}

/* =========================================================
   Page
========================================================= */
export default async function Page() {
  const supabase = await supabaseServer();

  /* =========================
     🔐 AUTH GATE
  ========================= */
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) {
    redirect(loginNext("/kitchen"));
  }

  /* =========================
     🔐 ROLE GATE (Hard email først, deretter profiles.role)
     FASET: profiles.user_id = auth.users.id
  ========================= */
  const emailRole = roleByEmail(user.email);
  let role: Role = emailRole ?? "employee";

  if (!emailRole) {
    // Fail-closed: hvis vi ikke får profil => ut
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("role, disabled_at, is_active")
      .or(`id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle<{
        role: string | null;
        disabled_at: string | null;
        is_active: boolean | null;
      }>();

    if (pErr || !profile) redirect(loginNext("/kitchen"));

    // Disabled gate
    if (profile.disabled_at) redirect(loginNext("/kitchen"));
    if (profile.is_active === false) redirect(loginNext("/kitchen"));

    role = normalizeRole(profile.role);
  }

  if (!allowKitchenOrSuperadmin(role)) {
    redirect("/week");
  }

  /* =========================
     ✅ PAGE
  ========================= */
  return (
    <>
      <div className="print:hidden">
        <PageSection
          title="Kjøkken"
          subtitle="Dagens produksjonsliste. Ordrene er gruppert per leveringsvindu, firma og lokasjon. Dette er fasit."
          right={
            <aside className="hidden w-full max-w-sm rounded-2xl bg-white px-4 py-3 text-xs text-[rgb(var(--lp-muted))] ring-1 ring-[rgb(var(--lp-border))] md:block">
              <div className="font-semibold text-slate-900">Driftsnotat</div>
              <ul className="mt-2 space-y-1">
                <li>Dato følger dagens Oslo-tid.</li>
                <li>Utskrift: bruk nettleserens print.</li>
                <li>Endringer etter cut-off registreres som avvik.</li>
              </ul>
            </aside>
          }
        />
      </div>

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
