// app/api/admin/me/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";


// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type CompanyStatus = "PENDING" | "ACTIVE" | "PAUSED" | "CLOSED";

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

export async function GET(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid, scope } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.me.read", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  const admin = supabaseAdmin();

  const userId = String(scope.userId ?? "").trim();
  if (!userId) return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTH");

  const { data: profile, error: pErr } = await admin
    .from("profiles")
    .select("id,email,role,company_id,location_id,disabled_at")
    .eq("id", userId)
    .maybeSingle();

  if (pErr) return jsonErr(rid, "Kunne ikke lese profil.", 500, { code: "PROFILE_READ_FAILED", detail: { message: pErr.message } });
  if (!profile) return jsonErr(rid, "Profil mangler. Kontakt support.", 403, "PROFILE_MISSING");

  const role = normRole((profile as any).role);

  if ((profile as any).disabled_at) {
    return jsonOk(rid, {
      locked: true,
      reason: "disabled",
      profile: { ...profile, role },
      company: null,
    });
  }

  if (!(profile as any).company_id) {
    return jsonOk(rid, {
      locked: true,
      reason: "missing_company",
      profile: { ...profile, role },
      company: null,
    });
  }

  const { data: company, error: cErr } = await admin
    .from("companies")
    .select("id,name,status,plan_tier")
    .eq("id", (profile as any).company_id)
    .maybeSingle();

  if (cErr) return jsonErr(rid, "Kunne ikke lese firma.", 500, { code: "COMPANY_READ_FAILED", detail: { message: cErr.message } });

  if (!company) {
    return jsonOk(rid, {
      locked: true,
      reason: "company_not_found",
      profile: { ...profile, role },
      company: null,
    });
  }

  const status = normStatus((company as any).status);

  if (status !== "ACTIVE") {
    return jsonOk(rid, {
      locked: true,
      reason: "company_not_active",
      profile: { ...profile, role },
      company: { ...company, status },
    });
  }

  return jsonOk(rid, {
    locked: false,
    profile: { ...profile, role },
    company: { ...company, status },
  });
}

