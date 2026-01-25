// app/api/admin/me/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type CompanyStatus = "PENDING" | "ACTIVE" | "PAUSED" | "CLOSED";

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status });
}

function normRole(v: any): Role {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "company_admin") return "company_admin";
  if (s === "superadmin") return "superadmin";
  if (s === "kitchen") return "kitchen";
  if (s === "driver") return "driver";
  return "employee";
}

function normStatus(v: any): CompanyStatus {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "PAUSED") return "PAUSED";
  if (s === "CLOSED") return "CLOSED";
  return "PENDING";
}

export async function GET() {
  // 1) Bekreft session via cookies (RLS-safe)
  const sb = await supabaseServer();
  const { data: auth, error: authErr } = await sb.auth.getUser();
  if (authErr) return jsonError(401, "auth_failed", "Kunne ikke lese innlogget bruker.", authErr);
  const user = auth?.user;
  if (!user) return jsonError(401, "not_signed_in", "Du må være innlogget.");

  // 2) Les profil med service role (unngår RLS-policies og loop)
  const admin = supabaseAdmin();

  const { data: profile, error: pErr } = await admin
    .from("profiles")
    .select("user_id,email,role,company_id,location_id,disabled_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (pErr) return jsonError(500, "profile_read_failed", "Kunne ikke lese profil.", pErr);
  if (!profile) return jsonError(403, "profile_missing", "Profil mangler. Kontakt support.");

  const role = normRole(profile.role);

  // 3) Bare company_admin får bruke /admin
  if (role !== "company_admin") {
    return jsonError(403, "forbidden", "Kun firma-admin har tilgang til admin.");
  }

  // 4) Deaktivert konto = låst
  if (profile.disabled_at) {
    return NextResponse.json({
      ok: true,
      locked: true,
      reason: "disabled",
      profile,
      company: null,
    });
  }

  // 5) Mangler firmatilknytning = låst
  if (!profile.company_id) {
    return NextResponse.json({
      ok: true,
      locked: true,
      reason: "missing_company",
      profile,
      company: null,
    });
  }

  // 6) Les firma (service role)
  const { data: company, error: cErr } = await admin
    .from("companies")
    .select("id,name,status,plan_tier")
    .eq("id", profile.company_id)
    .maybeSingle();

  if (cErr) return jsonError(500, "company_read_failed", "Kunne ikke lese firma.", cErr);
  if (!company) {
    return NextResponse.json({
      ok: true,
      locked: true,
      reason: "company_not_found",
      profile,
      company: null,
    });
  }

  const status = normStatus(company.status);
  if (status !== "ACTIVE") {
    return NextResponse.json({
      ok: true,
      locked: true,
      reason: "company_not_active",
      profile,
      company: { ...company, status },
    });
  }

  // 7) OK = unlocked
  return NextResponse.json({
    ok: true,
    locked: false,
    profile: { ...profile, role },
    company: { ...company, status },
  });
}
