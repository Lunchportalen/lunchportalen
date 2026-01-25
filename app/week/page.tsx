// app/week/page.tsx
import { redirect } from "next/navigation";
import WeekClient from "./WeekClient";
import { supabaseServer } from "@/lib/supabase/server";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

/* =========================================================
   Role helpers (samme prinsipp som admin/middleware)
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

function roleFromUser(user: any): Role {
  const raw = String(user?.user_metadata?.role ?? "employee").toLowerCase();
  if (raw === "company_admin") return "company_admin";
  if (raw === "superadmin") return "superadmin";
  if (raw === "kitchen") return "kitchen";
  if (raw === "driver") return "driver";
  return "employee";
}

function computeRole(user: any, profileRole?: any): Role {
  const byEmail = roleByEmail(user?.email);
  if (byEmail) return byEmail;

  const pr = String(profileRole ?? "").toLowerCase();
  if (pr === "company_admin") return "company_admin";
  if (pr === "superadmin") return "superadmin";
  if (pr === "kitchen") return "kitchen";
  if (pr === "driver") return "driver";
  if (pr === "employee") return "employee";

  return roleFromUser(user);
}

export default async function Page() {
  const supabase = await supabaseServer();

  // 1) Autentisering
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 2) Profil (FASIT: profiles.id === auth.users.id)
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, company_id, location_id")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[week/page] profile error:", error);
    redirect("/login");
  }

  // 3) Rolle: bruk profil hvis mulig, ellers fallback til auth metadata/byEmail
  const role: Role = computeRole(user, profile?.role);

  // 4) Hard routing-regler (company_admin skal aldri til /week)
  if (role === "superadmin") redirect("/superadmin");
  if (role === "kitchen") redirect("/kitchen");
  if (role === "driver") redirect("/driver");
  if (role === "company_admin") redirect("/admin");

  // 5) Week krever firmatilknytning (for employee)
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
  return (
    <main className="mx-auto max-w-5xl px-6 pb-10 pt-6">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight text-text">Planlegg lunsj</h1>
        <p className="mt-2 text-sm text-muted">
          Endringer låses kl. <span className="font-medium text-text">08:00</span> samme dag.
        </p>
      </div>

      <WeekClient />
    </main>
  );
}
