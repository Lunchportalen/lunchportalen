// app/api/profile/set-scope/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v)
  );
}

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type CompanyStatus = "ACTIVE" | "PENDING" | "PAUSED" | "CLOSED" | "UNKNOWN";
function normCompanyStatus(v: any): CompanyStatus {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "PENDING") return "PENDING";
  if (s === "PAUSED") return "PAUSED";
  if (s === "CLOSED") return "CLOSED";
  return "UNKNOWN";
}

export async function POST(req: Request) {
  const rid = makeRid();
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  // ✅ VIKTIG: supabaseServer() er async hos dere
  const sb = await supabaseServer();

  const { data: userRes, error: userErr } = await sb.auth.getUser();
  const user = userRes?.user ?? null;

  if (userErr || !user) return jsonErr(rid, "Ikke innlogget.", 401, "AUTH_REQUIRED");

  const { data: profile, error: profErr } = await sb
    .from("profiles")
    .select("id, role, company_id, location_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profErr) return jsonErr(rid, "Kunne ikke hente profil.", 500, { code: "PROFILE_LOOKUP_FAILED", detail: profErr.message });

  if (!profile?.id || !profile.company_id) {
    const res = jsonOk(rid, { ok: true, pending: true, reason: "PROFILE_NOT_READY", retryAfterMs: 800 }, 202) as NextResponse;
    res.headers.set("Retry-After", "1");
    return res;
  }

  const role = String(profile.role ?? "employee") as Role;

  if (!["company_admin", "superadmin", "employee"].includes(role)) return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN");

  const body = await req.json().catch(() => ({}));
  const locationId = body?.locationId;
  const companyIdFromClient = body?.companyId;

  if (!isUuid(locationId)) return jsonErr(rid, "Ugyldig locationId.", 400, "BAD_REQUEST");

  const companyId =
    role === "superadmin"
      ? (isUuid(companyIdFromClient) ? companyIdFromClient : null)
      : String(profile.company_id);

  if (!companyId) return jsonErr(rid, "Ugyldig companyId.", 400, "BAD_REQUEST");

  const admin = supabaseAdmin();

  const { data: company, error: compErr } = await admin
    .from("companies")
    .select("id,status")
    .eq("id", companyId)
    .maybeSingle();

  if (compErr || !company?.id) return jsonErr(rid, "Kunne ikke verifisere firmastatus.", 500, "COMPANY_LOOKUP_FAILED");

  const companyStatus = normCompanyStatus((company as any).status);
  if (companyStatus !== "ACTIVE") {
    return jsonErr(rid, "Firma er ikke aktivt.", 403, { code: "COMPANY_NOT_ACTIVE", detail: { status: companyStatus } });
  }

  const { data: loc, error: locErr } = await admin
    .from("company_locations")
    .select("id, company_id")
    .eq("id", locationId)
    .maybeSingle();

  if (locErr || !loc || String(loc.company_id) !== String(companyId)) return jsonErr(rid, "Ugyldig scope.", 400, "INVALID_SCOPE");

  const res = jsonOk(rid, { ok: true, pending: false, scope: { companyId, locationId } }, 200) as NextResponse;

  const secure = process.env.NODE_ENV === "production";

  res.cookies.set("lp_company_id", String(companyId), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  res.cookies.set("lp_location_id", String(locationId), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}

