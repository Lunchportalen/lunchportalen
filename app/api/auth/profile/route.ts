// app/api/auth/profile/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

type CompanyStatus = "ACTIVE" | "PENDING" | "PAUSED" | "CLOSED" | "UNKNOWN";

function normCompanyStatus(v: unknown): CompanyStatus {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "PENDING") return "PENDING";
  if (s === "PAUSED") return "PAUSED";
  if (s === "CLOSED") return "CLOSED";
  return "UNKNOWN";
}

type ProfileRow = {
  id: string;
  role: string | null;
  company_id: string | null;
  location_id: string | null;
  is_active: boolean | null;
  disabled_at: string | null;
  disabled_reason: string | null;
};

function hasDisabled(p: ProfileRow) {
  return Boolean(p.disabled_at) || Boolean(String(p.disabled_reason ?? "").trim());
}

export async function GET(_req: NextRequest) {
  const rid = makeRid();

  try {
    const { supabaseServer } = await import("@/lib/supabase/server");
    const sb = await supabaseServer();

    const { data: auth, error: authErr } = await sb.auth.getUser();
    const user = auth?.user ?? null;

    if (authErr || !user?.id) {
      return jsonErr(rid, "Not authenticated.", 401, "not_authenticated");
    }

    // ✅ IMPORTANT: Avoid heavy Supabase generics (prevents ts(2589))
    const p1 = await sb
      .from("profiles")
      .select("id, role, company_id, location_id, is_active, disabled_at, disabled_reason")
      .eq("id", user.id)
      .maybeSingle();

    let profile: ProfileRow | null = (p1.data as ProfileRow | null) ?? null;

    // Fallback: some schemas store auth.user.id under profiles.user_id
    if (!profile?.id) {
      // Using any query builder to avoid type instantiation loops
      const qb: any = sb
        .from("profiles")
        .select("id, role, company_id, location_id, is_active, disabled_at, disabled_reason");

      const p2 = await qb.eq("user_id", user.id).maybeSingle();
      const maybe = (p2?.data as ProfileRow | null) ?? null;
      if (maybe?.id) profile = maybe;
    }

    // If query error (RLS/column mismatch), fail safely without leaking
    if (p1.error && !profile?.id) {
      return jsonOk(
        rid,
        {
          ok: true,
          rid,
          profileExists: false,
          userId: user.id,
          pending: true,
          reason: "PROFILE_QUERY_ERROR",
          company_status: "UNKNOWN",
        },
        200
      );
    }

    if (!profile?.id) {
      return jsonOk(
        rid,
        {
          ok: true,
          rid,
          profileExists: false,
          userId: user.id,
          pending: true,
          reason: "PROFILE_NOT_FOUND",
          company_status: "UNKNOWN",
        },
        200
      );
    }

    if (hasDisabled(profile) || profile.is_active === false) {
      return jsonOk(
        rid,
        {
          ok: true,
          rid,
          profileExists: true,
          userId: user.id,
          pending: true,
          reason: "ACCOUNT_DISABLED",
          company_status: "UNKNOWN",
          profile,
        },
        200
      );
    }

    if (!profile.company_id) {
      return jsonOk(
        rid,
        {
          ok: true,
          rid,
          profileExists: true,
          userId: user.id,
          pending: true,
          reason: "PROFILE_NOT_READY",
          company_status: "UNKNOWN",
          profile,
        },
        200
      );
    }

    // Firmastatus gate (admin client, fail-closed)
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const admin = supabaseAdmin();

    const comp = await admin
      .from("companies")
      .select("id,status")
      .eq("id", profile.company_id)
      .maybeSingle();

    const company = (comp.data as { id: string; status: string | null } | null) ?? null;

    if (comp.error || !company?.id) {
      return jsonErr(rid, "Kunne ikke verifisere firmastatus.", 500, "company_lookup_failed");
    }

    const companyStatus = normCompanyStatus(company.status);

    if (companyStatus !== "ACTIVE") {
      return jsonOk(
        rid,
        {
          ok: true,
          rid,
          profileExists: true,
          pending: true,
          reason: companyStatus === "PENDING" ? "COMPANY_PENDING" : "COMPANY_NOT_ACTIVE",
          company_status: companyStatus,
          userId: user.id,
          profile,
        },
        200
      );
    }

    return jsonOk(
      rid,
      {
        ok: true,
        rid,
        profileExists: true,
        pending: false,
        company_status: "ACTIVE" as CompanyStatus,
        userId: user.id,
        profile,
      },
      200
    );
  } catch (e: any) {
    return jsonErr(rid, "Unexpected error.", 500, {
      code: "server_error",
      detail: String(e?.message ?? e),
    });
  }
}
