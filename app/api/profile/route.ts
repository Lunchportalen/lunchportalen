// app/api/auth/profile/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type CompanyStatus = "ACTIVE" | "PENDING" | "PAUSED" | "CLOSED" | "UNKNOWN";

const ALLOWED_ROLES: Role[] = ["employee", "company_admin", "superadmin", "kitchen", "driver"];

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function safeRole(v: unknown): Role {
  const r = safeStr(v).toLowerCase();
  if (r === "superadmin") return "superadmin";
  if (r === "company_admin") return "company_admin";
  if (r === "kitchen") return "kitchen";
  if (r === "driver") return "driver";
  return "employee";
}

function normCompanyStatus(v: unknown): CompanyStatus {
  const s = safeStr(v).toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "PENDING") return "PENDING";
  if (s === "PAUSED") return "PAUSED";
  if (s === "CLOSED") return "CLOSED";
  return "UNKNOWN";
}

type ProfileRow = {
  id: string;
  email: string | null;
  role: string | null;
  company_id: string | null;
  location_id: string | null;
  is_active: boolean | null;
  disabled_at: string | null;
  disabled_reason: string | null;
};

export async function GET() {
  const rid = makeRid();

  // SSR-safe client (leser session-cookie)
  const { supabaseServer } = await import("@/lib/supabase/server");
  const sb = await supabaseServer();

  const { data: userRes, error: userErr } = await sb.auth.getUser();
  const user = userRes?.user ?? null;

  if (userErr || !user) {
    return jsonErr(rid, "Ikke innlogget.", 401, "AUTH_REQUIRED");
  }

  // Profil må finnes (fail-closed)
  const { data: profile, error: profErr } = await sb
    .from("profiles")
    .select("id, email, role, company_id, location_id, is_active, disabled_at, disabled_reason")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (profErr) {
    return jsonErr(rid, profErr.message, 500, "PROFILE_LOOKUP_FAILED");
  }

  if (!profile?.id) {
    return jsonErr(
      rid,
      "Brukerprofil finnes ikke. Be firma-admin legge deg til som ansatt.",
      404,
      "PROFILE_NOT_FOUND"
    );
  }

  const role = safeRole(profile.role);
  const rawRole = safeStr(profile.role).toLowerCase();

  // Hvis role er satt til noe ugyldig i DB, stopp (fail-closed)
  if (rawRole && !ALLOWED_ROLES.includes(rawRole as Role)) {
    return jsonErr(rid, "Ingen tilgang for denne rollen.", 403, "ROLE_FORBIDDEN");
  }

  // Disabled/inactive → hard stop (403)
  if (profile.disabled_at || safeStr(profile.disabled_reason)) {
    return jsonErr(rid, "Kontoen er deaktivert. Kontakt administrator.", 403, "ACCOUNT_DISABLED");
  }
  if (profile.is_active === false) {
    return jsonErr(rid, "Kontoen er deaktivert. Kontakt administrator.", 403, "ACCOUNT_DISABLED");
  }

  // Required linkage for employee/company_admin
  if ((role === "employee" || role === "company_admin") && !profile.company_id) {
    return jsonErr(
      rid,
      "Kontoen er ikke koblet til firma. Kontakt firma-admin.",
      409,
      "PROFILE_NOT_READY"
    );
  }
  if (role === "employee" && !profile.location_id) {
    return jsonErr(
      rid,
      "Kontoen er ikke koblet til lokasjon. Kontakt firma-admin.",
      409,
      "PROFILE_NOT_READY"
    );
  }

  // Superadmin/kitchen/driver trenger ikke company-gate (de er systemroller)
  if (role === "superadmin" || role === "kitchen" || role === "driver") {
    return jsonOk(
      rid,
      {
        ok: true,
        rid,
        pending: false,
        profileExists: true,
        profile: {
          id: profile.id,
          role,
          company_id: profile.company_id,
          location_id: profile.location_id,
          is_active: profile.is_active,
          disabled_at: profile.disabled_at,
          disabled_reason: profile.disabled_reason,
        },
      },
      200
    );
  }

  // Company status gate (for employee/company_admin) – fail-closed
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const admin = supabaseAdmin();

  const { data: company, error: compErr } = await admin
    .from("companies")
    .select("id,status")
    .eq("id", profile.company_id)
    .maybeSingle<{ id: string; status: string | null }>();

  if (compErr || !company?.id) {
    return jsonErr(rid, "Kunne ikke verifisere firmastatus.", 500, "COMPANY_LOOKUP_FAILED");
  }

  const companyStatus = normCompanyStatus(company.status);

  // Ikke ACTIVE → pending (200) slik LoginForm håndterer dette eksplisitt
  if (companyStatus !== "ACTIVE") {
    return jsonOk(
      rid,
      {
        ok: true,
        rid,
        pending: true,
        reason: companyStatus === "PENDING" ? "COMPANY_PENDING" : "COMPANY_NOT_ACTIVE",
        company_status: companyStatus,
        profileExists: true,
        profile: {
          id: profile.id,
          role,
          company_id: profile.company_id,
          location_id: profile.location_id,
          is_active: profile.is_active,
          disabled_at: profile.disabled_at,
          disabled_reason: profile.disabled_reason,
        },
      },
      200
    );
  }

  // Klar (200)
  return jsonOk(
    rid,
    {
      ok: true,
      rid,
      pending: false,
      profileExists: true,
      profile: {
        id: profile.id,
        role,
        company_id: profile.company_id,
        location_id: profile.location_id,
        is_active: profile.is_active,
        disabled_at: profile.disabled_at,
        disabled_reason: profile.disabled_reason,
      },
    },
    200
  );
}
