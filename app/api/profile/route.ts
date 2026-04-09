// app/api/profile/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type CompanyStatus = "ACTIVE" | "PENDING" | "PAUSED" | "CLOSED" | "UNKNOWN";

type ProfileRow = {
  id: string | null;
  email: string | null;
  is_active: boolean | null;
  disabled_at: string | null;
  disabled_reason: string | null;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normCompanyStatus(v: unknown): CompanyStatus {
  const s = safeStr(v).toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "PENDING") return "PENDING";
  if (s === "PAUSED") return "PAUSED";
  if (s === "CLOSED") return "CLOSED";
  return "UNKNOWN";
}

function buildProfilePayload(input: {
  userId: string;
  role: Role;
  companyId: string | null;
  locationId: string | null;
  profile: ProfileRow | null;
}) {
  return {
    id: input.userId,
    role: input.role,
    company_id: input.companyId,
    location_id: input.locationId,
    is_active: input.profile?.is_active ?? true,
    disabled_at: input.profile?.disabled_at ?? null,
    disabled_reason: input.profile?.disabled_reason ?? null,
  };
}

async function loadProfileMeta(userId: string): Promise<{ profile: ProfileRow | null; error: string | null }> {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const sb = await supabaseServer();

  const byUserId = await sb
    .from("profiles")
    .select("id, email, is_active, disabled_at, disabled_reason")
    .eq("user_id", userId)
    .maybeSingle<ProfileRow>();

  if (byUserId.data?.id) {
    return { profile: byUserId.data, error: null };
  }

  const byId = await sb
    .from("profiles")
    .select("id, email, is_active, disabled_at, disabled_reason")
    .eq("id", userId)
    .maybeSingle<ProfileRow>();

  const profile = byId.data?.id ? byId.data : null;
  const error = byUserId.error?.message?.trim() || byId.error?.message?.trim() || null;
  return { profile, error };
}

export async function GET(request?: Request) {
  const rid = makeRid();

  const auth = await getAuthContext({
    rid,
    reqHeaders: request?.headers ?? null,
  });
  if (!auth.isAuthenticated || !auth.userId) {
    return jsonErr(rid, "Ikke innlogget.", 401, "AUTH_REQUIRED");
  }

  if (auth.reason === "NO_PROFILE") {
    return jsonErr(
      rid,
      "Brukerprofil finnes ikke. Be firma-admin legge deg til som ansatt.",
      404,
      "PROFILE_NOT_FOUND",
    );
  }

  if (auth.reason === "BLOCKED") {
    return jsonErr(rid, "Kontoen er deaktivert. Kontakt administrator.", 403, "ACCOUNT_DISABLED");
  }

  if (!auth.role) {
    return jsonErr(rid, "Ingen tilgang for denne rollen.", 403, "ROLE_FORBIDDEN");
  }

  if (auth.mode === "DEV_BYPASS") {
    return jsonOk(
      rid,
      {
        ok: true,
        rid,
        pending: false,
        profileExists: true,
        company_status: "UNKNOWN" as CompanyStatus,
        profile: buildProfilePayload({
          userId: auth.userId,
          role: auth.role,
          companyId: auth.company_id,
          locationId: auth.location_id,
          profile: null,
        }),
      },
      200,
    );
  }

  const { profile, error } = await loadProfileMeta(auth.userId);
  if (error && !profile?.id) {
    return jsonErr(rid, error, 500, "PROFILE_LOOKUP_FAILED");
  }

  if (profile?.disabled_at || safeStr(profile?.disabled_reason) || profile?.is_active === false) {
    return jsonErr(rid, "Kontoen er deaktivert. Kontakt administrator.", 403, "ACCOUNT_DISABLED");
  }

  const profilePayload = buildProfilePayload({
    userId: auth.userId,
    role: auth.role,
    companyId: auth.company_id,
    locationId: auth.location_id,
    profile,
  });

  if (auth.role === "superadmin" || auth.role === "kitchen" || auth.role === "driver") {
    return jsonOk(
      rid,
      {
        ok: true,
        rid,
        pending: false,
        profileExists: true,
        company_status: "UNKNOWN" as CompanyStatus,
        profile: profilePayload,
      },
      200,
    );
  }

  if (!auth.company_id) {
    return jsonErr(
      rid,
      "Kontoen er ikke koblet til firma. Kontakt firma-admin.",
      409,
      "PROFILE_NOT_READY",
    );
  }

  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const admin = supabaseAdmin();
  const { data: company, error: compErr } = await admin
    .from("companies")
    .select("id,status")
    .eq("id", auth.company_id)
    .maybeSingle<{ id: string; status: string | null }>();

  if (compErr || !company?.id) {
    return jsonErr(rid, "Kunne ikke verifisere firmastatus.", 500, "COMPANY_LOOKUP_FAILED");
  }

  const companyStatus = normCompanyStatus(company.status);
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
        profile: profilePayload,
      },
      200,
    );
  }

  return jsonOk(
    rid,
    {
      ok: true,
      rid,
      pending: false,
      profileExists: true,
      company_status: "ACTIVE" as CompanyStatus,
      profile: profilePayload,
    },
    200,
  );
}
