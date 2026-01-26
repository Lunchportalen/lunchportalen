// app/kitchen/page.tsx
import { redirect } from "next/navigation";
import KitchenView from "./KitchenView";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

/* =========================================================
   Role helpers (NO DB) – samme prinsipp som middleware
========================================================= */

function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function roleByEmail(email: string | null | undefined): Role | null {
  const e = normEmail(email);
  if (e === "superadmin@lunchportalen.no") return "superadmin";
  if (e === "kjokken@lunchportalen.no") return "kitchen";
  if (e === "driver@lunchportalen.no") return "driver";
  return null;
}

function normalizeRole(v: unknown): Role {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "company_admin" || s === "companyadmin" || s === "admin") return "company_admin";
  if (s === "superadmin") return "superadmin";
  if (s === "kitchen") return "kitchen";
  if (s === "driver") return "driver";
  return "employee";
}

function computeRoleNoDb(user: any): Role {
  const emailRole = roleByEmail(user?.email);
  if (emailRole) return emailRole;

  const appRole = normalizeRole(user?.app_metadata?.role);
  if (appRole !== "employee") return appRole;

  const metaRole = normalizeRole(user?.user_metadata?.role);
  return metaRole;
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

  if (authErr || !auth?.user) {
    redirect("/login?next=/kitchen");
  }

  /* =========================
     🔐 ROLE GATE (NO DB)
  ========================= */
  const role = computeRoleNoDb(auth.user);

  // ✅ Kun kitchen og superadmin
  if (role !== "kitchen" && role !== "superadmin") {
    redirect("/week");
  }

  /* =========================
     ✅ PAGE
  ========================= */
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 print:p-0">
      {/* Header / topbar i samme rytme som andre sider */}
      <div className="mb-8">
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
            <div className="hidden w-full max-w-sm rounded-2xl bg-white px-4 py-3 text-xs text-[rgb(var(--lp-muted))] ring-1 ring-[rgb(var(--lp-border))] md:block print:hidden">
              <div className="font-semibold text-slate-900">Driftsnotat</div>
              <ul className="mt-2 space-y-1">
                <li>• Bruk datovelger for å hente riktig produksjon</li>
                <li>• Utskrift: bruk nettleserens print</li>
                <li>• Superadmin kan også se kjøkkenvisning</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Selve kjøkkenvisningen (datovelger, grupper, print, eksport osv.) */}
      <KitchenView />
    </main>
  );
}
