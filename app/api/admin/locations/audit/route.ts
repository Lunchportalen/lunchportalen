// app/api/admin/locations/audit/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getScope, allowSuperadminOrCompanyAdmin, mustCompanyId } from "@/lib/auth/scope";

function jsonErr(status: number, error: string, detail?: string) {
  return NextResponse.json({ ok: false, error, detail }, { status });
}

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function clampInt(v: any, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return Math.min(max, Math.max(min, i));
}

export async function GET(req: NextRequest) {
  try {
    const scope = await getScope(req);
    allowSuperadminOrCompanyAdmin(scope);

    const supabase = await supabaseServer();
    const url = new URL(req.url);

    const locationId = String(url.searchParams.get("location_id") ?? "").trim();
    const mode = String(url.searchParams.get("mode") ?? "latest").trim().toLowerCase(); // latest | list
    const limit = clampInt(url.searchParams.get("limit"), 1, 50, 10);

    if (!isUuid(locationId)) return jsonErr(400, "BAD_REQUEST", "Mangler/ugyldig location_id.");

    // tenant lock for company_admin: location must belong to own company
    if (scope.role !== "superadmin") {
      const myCompanyId = mustCompanyId(scope);

      const { data: loc, error: locErr } = await supabase
        .from("company_locations")
        .select("id,company_id")
        .eq("id", locationId)
        .maybeSingle();

      if (locErr) return jsonErr(500, "DB_ERROR", locErr.message);
      if (!loc) return jsonErr(404, "NOT_FOUND", "Lokasjon finnes ikke.");
      if (String((loc as any).company_id) !== String(myCompanyId)) return jsonErr(403, "FORBIDDEN", "Ingen tilgang.");
    }

    if (mode === "list") {
      const { data, error } = await supabase
        .from("location_audit")
        .select("id,location_id,company_id,actor_email,actor_user_id,action,created_at,diff")
        .eq("location_id", locationId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) return jsonErr(500, "DB_ERROR", error.message);

      return NextResponse.json({ ok: true, items: data ?? [] }, { status: 200 });
    }

    // default: latest
    const { data: row, error } = await supabase
      .from("location_audit")
      .select("id,location_id,company_id,actor_email,actor_user_id,action,created_at,diff")
      .eq("location_id", locationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return jsonErr(500, "DB_ERROR", error.message);

    return NextResponse.json({ ok: true, latest: row ?? null }, { status: 200 });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const code = e?.code || "ERROR";
    return jsonErr(status, code, e?.message || "Ukjent feil.");
  }
}
