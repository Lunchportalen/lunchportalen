// app/api/auth/profile/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type CompanyStatus = "ACTIVE" | "PENDING" | "PAUSED" | "CLOSED" | "UNKNOWN";
const ALLOWED_ROLES: Role[] = ["employee", "company_admin", "superadmin", "kitchen", "driver"];

function safeRole(v: any): Role {
  const r = String(v ?? "employee");
  if (r === "superadmin" || r === "company_admin" || r === "kitchen" || r === "driver" || r === "employee") return r;
  return "employee";
}
function normCompanyStatus(v: any): CompanyStatus {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "PENDING") return "PENDING";
  if (s === "PAUSED") return "PAUSED";
  if (s === "CLOSED") return "CLOSED";
  return "UNKNOWN";
}

export async function GET() {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const rid = makeRid();

  const sb = await supabaseServer();
  const { data: userRes, error: userErr } = await sb.auth.getUser();
  const user = userRes?.user ?? null;

  if (userErr || !user) {
    // behold gammel shape (profileExists)
    return jsonErr(rid, "Ikke innlogget.", 401, "AUTH_REQUIRED");
  }

  const { data: profile, error: profErr } = await sb
    .from("profiles")
    .select("id, email, role, company_id, location_id, department, name, full_name, is_active, disabled_at, disabled_reason")
    .eq("id", user.id)
    .maybeSingle();

  if (profErr) {
    return jsonErr(rid, profErr.message, 500, "PROFILE_LOOKUP_FAILED");
  }

  if (!profile?.id) {
    return jsonErr(
      rid,
      "Brukerprofil finnes ikke. Be firma-admin legge deg til som ansatt.",
      404,
      "PROFILE_NOT_FOUND" // terminal: profile missing
    );
  }

  const rawRole = String(profile.role ?? "").trim().toLowerCase();
  if (rawRole && !ALLOWED_ROLES.includes(rawRole as Role)) {
    return jsonErr(rid, "Ingen tilgang for denne rollen.", 403, "ROLE_FORBIDDEN" /* terminal: forbidden role */);
  }

  // Disabled / inactive → hard stop
  if (profile.disabled_at || profile.disabled_reason) {
    return jsonOk(rid, {
      ok: true,
      rid,
      profileExists: true,
      profile: {
        id: profile.id,
        role: safeRole(profile.role),
        company_id: profile.company_id,
        location_id: profile.location_id,
        is_active: profile.is_active,
        disabled_at: profile.disabled_at,
        disabled_reason: profile.disabled_reason,
      },
    }, 403);
  }

  if (profile.is_active === false) {
    return jsonOk(rid, {
      ok: true,
      rid,
      profileExists: true,
      profile: {
        id: profile.id,
        role: safeRole(profile.role),
        company_id: profile.company_id,
        location_id: profile.location_id,
        is_active: profile.is_active,
        disabled_at: profile.disabled_at,
        disabled_reason: profile.disabled_reason,
      },
    }, 403);
  }

  const role = safeRole(profile.role);

  // Required linkage for employee/company_admin
  if ((role === "employee" || role === "company_admin") && !profile.company_id) {
    return jsonErr(
      rid,
      "Kontoen er ikke koblet til firma/lokasjon. Kontakt firma-admin.",
      409,
      "PROFILE_NOT_READY" // terminal: missing company linkage
    );
  }
  if (role === "employee" && !profile.location_id) {
    return jsonErr(
      rid,
      "Kontoen er ikke koblet til firma/lokasjon. Kontakt firma-admin.",
      409,
      "PROFILE_NOT_READY" // terminal: missing location linkage
    );
  }

  // Company status gate (fail-closed)
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const admin = supabaseAdmin();
  const { data: company, error: compErr } = await admin
    .from("companies")
    .select("id,status")
    .eq("id", profile.company_id)
    .maybeSingle();

  if (compErr || !company?.id) {
    return jsonErr(rid, "Kunne ikke verifisere firmastatus.", 500, "COMPANY_LOOKUP_FAILED");
  }

  const companyStatus = normCompanyStatus((company as any).status);
  if (companyStatus !== "ACTIVE") {
    return jsonOk(rid, {
      ok: true,
      rid,
      pending: true,
      reason: companyStatus === "PENDING" ? "COMPANY_PENDING" : "COMPANY_NOT_ACTIVE",
      company_status: companyStatus,
      profileExists: true,
      profile: {
        id: profile.id,
        role: safeRole(profile.role),
        company_id: profile.company_id,
        location_id: profile.location_id,
        is_active: profile.is_active,
        disabled_at: profile.disabled_at,
        disabled_reason: profile.disabled_reason,
      },
    }, 200);
  }

  // Klar
  return jsonOk(rid, {
    ok: true,
    rid,
    pending: false,
    profileExists: true,
    profile: {
      id: profile.id,
      role: safeRole(profile.role),
      company_id: profile.company_id,
      location_id: profile.location_id,
      is_active: profile.is_active,
      disabled_at: profile.disabled_at,
      disabled_reason: profile.disabled_reason,
    },
  }, 200);
}
