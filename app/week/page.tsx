// app/week/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import WeekClient from "./WeekClient";
import { supabaseServer } from "@/lib/supabase/server";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

/* =========================================================
   Role helpers (samme prinsipp som admin/middleware)
   - Ingen unntak i flyt: kun routing/guard
========================================================= */
function safeStr(v: any) {
  return String(v ?? "").trim();
}
function normEmail(v: any) {
  return safeStr(v).toLowerCase();
}

function roleByEmail(email: string | null | undefined): Role | null {
  const e = normEmail(email);
  if (e === "superadmin@lunchportalen.no") return "superadmin";
  if (e === "kjokken@lunchportalen.no") return "kitchen";
  if (e === "driver@lunchportalen.no") return "driver";
  return null;
}

function roleFromUser(user: any): Role {
  const raw = safeStr(user?.user_metadata?.role).toLowerCase();
  if (raw === "company_admin") return "company_admin";
  if (raw === "superadmin") return "superadmin";
  if (raw === "kitchen") return "kitchen";
  if (raw === "driver") return "driver";
  return "employee";
}

function computeRole(user: any, profileRole?: any): Role {
  const byEmail = roleByEmail(user?.email);
  if (byEmail) return byEmail;

  const pr = safeStr(profileRole).toLowerCase();
  if (pr === "company_admin") return "company_admin";
  if (pr === "superadmin") return "superadmin";
  if (pr === "kitchen") return "kitchen";
  if (pr === "driver") return "driver";
  if (pr === "employee") return "employee";

  return roleFromUser(user);
}

export default async function Page() {
  const supabase = await supabaseServer();

  // 1) Autentisering (med sikker redirect til login)
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) redirect("/login?next=/week");

  const user = auth.user;

  // 2) Profil (FASIT: profiles.id === auth.users.id)
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role, company_id, location_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr) {
    console.error("[week/page] profile error:", profileErr);
    redirect("/login?next=/week");
  }

  // 3) Rolle: profil hvis mulig, ellers fallback til auth metadata/byEmail
  const role: Role = computeRole(user, profile?.role);

  // 4) Hard routing-regler (roller er absolutte)
  if (role === "superadmin") redirect("/superadmin");
  if (role === "kitchen") redirect("/kitchen");
  if (role === "driver") redirect("/driver");
  if (role === "company_admin") redirect("/admin");

  // 5) Week krever firmatilknytning (employee)
  if (!profile?.company_id || !profile?.location_id) {
    return (
      <main className="mx-auto max-w-3xl px-6 pb-10 pt-6">
        <h1 className="text-2xl font-semibold tracking-tight text-text">Mangler firmatilknytning</h1>
        <p className="mt-2 text-sm text-muted">
          Kontoen din er ikke knyttet til et firma eller en lokasjon. Ta kontakt med firmaets administrator.
        </p>
      </main>
    );
  }

  // 6) Alt OK → vis ukeplanlegging
  // NB: Status/kvittering/e-post-backup implementeres i WeekClient + API (Dag 2 full pakke),
  //     men denne siden skal være stabil, cache-fri og riktig rutet.
  return (
    <main className="mx-auto max-w-5xl px-6 pb-10 pt-6">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-text">Planlegg lunsj</h1>
        <p className="mt-2 text-sm text-muted">
          Endringer låses kl. <span className="font-medium text-text">08:00</span> samme dag.
        </p>
      </header>

      <WeekClient />
    </main>
  );
}
