// app/kitchen/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import KitchenView from "./KitchenView";
import { supabaseServer } from "@/lib/supabase/server";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

/* =========================================================
   Helpers (enterprise-safe)
========================================================= */
function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function normEmail(v: unknown) {
  return safeStr(v).toLowerCase();
}

/**
 * 🔒 NO-EXCEPTION RULE:
 * - Hard system-e-poster er fasit
 * - Deretter profiles.role (server truth)
 */
function roleByEmail(email: string | null | undefined): Role | null {
  const e = normEmail(email);
  if (!e) return null;

  if (e === "superadmin@lunchportalen.no") return "superadmin";
  if (e === "kjokken@lunchportalen.no") return "kitchen";
  if (e === "driver@lunchportalen.no") return "driver";

  return null;
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
    redirect("/login?next=/kitchen");
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
      .eq("user_id", user.id)
      .maybeSingle<{
        role: string | null;
        disabled_at: string | null;
        is_active: boolean | null;
      }>();

    if (pErr || !profile) redirect("/login?next=/kitchen");

    // Disabled gate
    if (profile.disabled_at) redirect("/login?next=/kitchen");
    if (profile.is_active === false) redirect("/login?next=/kitchen");

    role = normalizeRole(profile.role);
  }

  if (!allowKitchenOrSuperadmin(role)) {
    redirect("/week");
  }

  /* =========================
     ✅ PAGE
  ========================= */
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 print:p-0">
      {/* Header / topbar i samme rytme som andre sider */}
      <div className="mb-8 print:hidden">
        <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Kjøkken</h1>
              <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
                Dagens produksjonsliste – sortert per leveringsvindu, firma, lokasjon og ansatt. Klar for utskrift.
              </p>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[rgb(var(--lp-muted))]">
                <span className="rounded-full bg-black/5 px-3 py-1">📅 Dato & leveringsdag</span>
                <span className="rounded-full bg-black/5 px-3 py-1">⌛ Hurtigvalg</span>
                <span className="rounded-full bg-black/5 px-3 py-1">🖨️ Print</span>
                <span className="rounded-full bg-black/5 px-3 py-1">📦 Samlevolum</span>
              </div>
            </div>

            {/* Driftshint: kun info, ikke actions (KitchenView har kontrollene) */}
            <aside className="hidden w-full max-w-sm rounded-2xl bg-white px-4 py-3 text-xs text-[rgb(var(--lp-muted))] ring-1 ring-[rgb(var(--lp-border))] md:block">
              <div className="font-semibold text-slate-900">Driftsnotat</div>
              <ul className="mt-2 space-y-1">
                <li>• Bruk datovelger for å hente riktig produksjon</li>
                <li>• Utskrift: bruk nettleserens print</li>
                <li>• Superadmin kan også se kjøkkenvisning</li>
              </ul>
            </aside>
          </div>
        </div>
      </div>

      {/* Print header (kun print) */}
      <div className="mb-4 hidden print:block">
        <div className="text-xl font-semibold">Kjøkken – produksjonsliste</div>
        <div className="text-xs text-slate-600">Generert fra Lunchportalen</div>
      </div>

      {/* Selve kjøkkenvisningen */}
      <KitchenView />
    </main>
  );
}
