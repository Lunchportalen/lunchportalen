// app/api/profile/set-scope/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}

function json(status: number, body: any) {
  return NextResponse.json(body, { status, headers: noStore() });
}

function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v)
  );
}

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

export async function POST(req: Request) {
  // ✅ VIKTIG: supabaseServer() er async hos dere
  const sb = await supabaseServer();

  const { data: userRes, error: userErr } = await sb.auth.getUser();
  const user = userRes?.user ?? null;

  if (userErr || !user) return json(401, { ok: false, error: "AUTH_REQUIRED" });

  const { data: profile, error: profErr } = await sb
    .from("profiles")
    .select("id, role, company_id, location_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profErr) return json(500, { ok: false, error: "PROFILE_LOOKUP_FAILED", message: profErr.message });

  if (!profile?.id || !profile.company_id) {
    return NextResponse.json(
      { ok: true, pending: true, reason: "PROFILE_NOT_READY", retryAfterMs: 800 },
      { status: 202, headers: { ...noStore(), "Retry-After": "1" } }
    );
  }

  const role = String(profile.role ?? "employee") as Role;

  if (!["company_admin", "superadmin", "employee"].includes(role)) {
    return json(403, { ok: false, error: "FORBIDDEN" });
  }

  const body = await req.json().catch(() => ({}));
  const locationId = body?.locationId;
  const companyIdFromClient = body?.companyId;

  if (!isUuid(locationId)) return json(400, { ok: false, error: "BAD_REQUEST", message: "Ugyldig locationId." });

  const companyId =
    role === "superadmin"
      ? (isUuid(companyIdFromClient) ? companyIdFromClient : null)
      : String(profile.company_id);

  if (!companyId) return json(400, { ok: false, error: "BAD_REQUEST", message: "Ugyldig companyId." });

  const admin = supabaseAdmin();

  const { data: loc, error: locErr } = await admin
    .from("company_locations")
    .select("id, company_id")
    .eq("id", locationId)
    .maybeSingle();

  if (locErr || !loc || String(loc.company_id) !== String(companyId)) {
    return json(400, { ok: false, error: "INVALID_SCOPE" });
  }

  const res = NextResponse.json(
    { ok: true, pending: false, scope: { companyId, locationId } },
    { status: 200, headers: noStore() }
  );

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
