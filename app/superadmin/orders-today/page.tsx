// app/superadmin/orders-today/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type ProfileRow = { role: Role | null };

function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}
function isHardSuperadmin(email: string | null | undefined) {
  return normEmail(email) === "superadmin@lunchportalen.no";
}

export default async function OrdersTodayPage() {
  const sb = await supabaseServer();

  // -----------------------------
  // Auth gate
  // -----------------------------
  const { data: auth, error: authErr } = await sb.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) {
    redirect("/login?next=/superadmin/orders-today");
  }

  // -----------------------------
  // Superadmin gate (FASET)
  // -----------------------------
  const { data: profile, error: pErr } = await sb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (pErr || !profile?.role) redirect("/login?next=/superadmin");
  if (profile.role !== "superadmin" || !isHardSuperadmin(user.email)) {
    redirect("/login?next=/superadmin");
  }

  return (
    <main className="lp-container lp-select-text">
      <h1 className="lp-h1">Dagens ordre</h1>
      <p className="lp-muted mt-2">
        Oversikt over dagens aktive bestillinger. (Kommer: filter, eksport/print, og grupper per
        leveringsvindu → firma → lokasjon.)
      </p>

      <div className="lp-card lp-card-pad mt-6">
        <div className="lp-row">
          <div>
            <div className="lp-sectionTitle">Status</div>
            <div className="lp-listMeta mt-1">Siden er opprettet og ruten er aktiv.</div>
          </div>
          <span className="lp-chip lp-chip-ok">OK</span>
        </div>

        <div className="lp-divider my-5" />

        <div className="lp-listMeta">
          Neste steg: koble til eksisterende OperationsToday-queries og rendere faktiske data
          gruppert per leveringsvindu → firma → lokasjon.
        </div>
      </div>
    </main>
  );
}
