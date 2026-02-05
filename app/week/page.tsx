// app/week/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import WeekClient from "./WeekClient";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import PageSection from "@/components/layout/PageSection";
import { systemRoleByEmail } from "@/lib/system/emails";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type CompanyStatus = "ACTIVE" | "PENDING" | "PAUSED" | "CLOSED" | "UNKNOWN";

/* =========================================================
   Role helpers (samme prinsipp som admin/middleware)
   - Ingen unntak i flyt: kun routing/guard
========================================================= */
function safeStr(v: any) {
  return String(v ?? "").trim();
}
function roleByEmail(email: string | null | undefined): Role | null {
  return systemRoleByEmail(email);
}

function roleFromUser(user: any): Role {
  const raw = safeStr(user?.user_metadata?.role).toLowerCase();
  if (raw === "company_admin") return "company_admin";
  if (raw === "superadmin") return "superadmin";
  if (raw === "kitchen") return "kitchen";
  if (raw === "driver") return "driver";
  return "employee";
}

function normCompanyStatus(v: any): CompanyStatus {
  const s = safeStr(v).toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "PENDING") return "PENDING";
  if (s === "PAUSED") return "PAUSED";
  if (s === "CLOSED") return "CLOSED";
  return "UNKNOWN";
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
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
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
      <PageSection
        title="Mangler firmatilknytning"
        subtitle="Kontoen din er ikke knyttet til et firma eller en lokasjon. Ta kontakt med firmaets administrator."
      />
    );
  }

  const admin = supabaseAdmin();
  const { data: company, error: compErr } = await admin
    .from("companies")
    .select("id,status")
    .eq("id", profile.company_id)
    .maybeSingle();

  if (compErr || !company?.id) {
    redirect("/login?next=/week");
  }

  const companyStatus = normCompanyStatus((company as any).status);
  if (companyStatus === "PENDING") redirect("/pending");
  if (companyStatus === "PAUSED" || companyStatus === "CLOSED") {
    redirect(`/status?state=${encodeURIComponent(companyStatus.toLowerCase())}&next=${encodeURIComponent("/week")}`);
  }
  // 6) Alt OK → vis ukeplanlegging
  // NB: Status/kvittering/e-post-backup implementeres i WeekClient + API (Dag 2 full pakke),
  //     men denne siden skal være stabil, cache-fri og riktig rutet.
  return (
    <PageSection
      title="Planlegg lunsj"
      subtitle={
        <>
          Endringer låses kl. <span className="font-medium text-text">08:00</span> samme dag.
        </>
      }
    >
      <WeekClient />
    </PageSection>
  );
}



