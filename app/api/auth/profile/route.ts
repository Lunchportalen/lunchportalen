// app/api/auth/profile/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

type CompanyStatus = "ACTIVE" | "PENDING" | "PAUSED" | "CLOSED" | "UNKNOWN";
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

  try {
    // ✅ Viktig i ditt prosjekt: supabaseServer() er async
    const sb = await supabaseServer();

    const { data: auth, error: authErr } = await sb.auth.getUser();
    if (authErr) return jsonErr(rid, "Not authenticated.", 401, "not_authenticated");

    const user = auth?.user ?? null;
    if (!user?.id) return jsonErr(rid, "Not authenticated.", 401, "not_authenticated");

    // ✅ Service-side check med cookie-auth (RLS gjelder)
    const p = await sb
      .from("profiles")
      .select("id, role, company_id, location_id, is_active, disabled_at, disabled_reason")
      .eq("id", user.id)
      .maybeSingle();

    // Ved RLS/kolonnefeil: ikke leak, men returner profileExists=false
    if (p.error) {
      return jsonOk(rid, {
        ok: true,
        rid,
        profileExists: false,
        userId: user.id,
        note: "profile_query_error",
      }, 200);
    }

    if (!p.data?.id) {
      return jsonOk(rid, { ok: true, rid, profileExists: false, userId: user.id }, 200);
    }

    if (!p.data?.company_id) {
      return jsonOk(rid, { ok: true, rid, profileExists: false, userId: user.id, pending: true, reason: "PROFILE_NOT_READY" }, 200);
    }

    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const admin = supabaseAdmin();
    const { data: company, error: compErr } = await admin
      .from("companies")
      .select("id,status")
      .eq("id", p.data.company_id)
      .maybeSingle();

    if (compErr || !company?.id) return jsonErr(rid, "Kunne ikke verifisere firmastatus.", 500, "company_lookup_failed");

    const companyStatus = normCompanyStatus((company as any).status);
    if (companyStatus !== "ACTIVE") {
      return jsonOk(rid, {
        ok: true,
        rid,
        profileExists: true,
        pending: true,
        reason: companyStatus === "PENDING" ? "COMPANY_PENDING" : "COMPANY_NOT_ACTIVE",
        company_status: companyStatus,
        userId: user.id,
        profile: p.data,
      }, 200);
    }

    return jsonOk(rid, { ok: true, rid, profileExists: true, pending: false, userId: user.id, profile: p.data }, 200);
  } catch (e: any) {
    return jsonErr(rid, "Unexpected error.", 500, { code: "server_error", detail: String(e?.message ?? e) });
  }
}

