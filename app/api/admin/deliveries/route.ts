// app/api/admin/deliveries/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function ridFrom(req: NextRequest) {
  return safeStr(req.headers.get("x-rid")) || `rid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
function ok(rid: string, body: any, status = 200) {
  return NextResponse.json({ ok: true, rid, ...body }, { status });
}
function err(rid: string, status: number, code: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid, error: code, message, detail: detail ?? null }, { status });
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * GET /api/admin/deliveries
 * Query:
 *  - date?: YYYY-MM-DD (valgfri)
 *  - limit?: 1..200 (default 100)
 * Roles: company_admin | superadmin
 * Runtime-only (Supabase/env)
 */
export async function GET(req: NextRequest) {
  const rid = ridFrom(req);

  try {
    // ✅ Late import – stopper env-evaluering under next build
    const { supabaseServer } = await import("@/lib/supabase/server");
    const sb = await supabaseServer();

    // Auth
    const { data: auth, error: authErr } = await sb.auth.getUser();
    const user = auth?.user ?? null;
    if (authErr || !user) return err(rid, 401, "UNAUTHENTICATED", "Du må være innlogget.");

    // Profile
    const { data: prof, error: profErr } = await sb
      .from("profiles")
      .select("role, company_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profErr) return err(rid, 500, "PROFILE_READ_FAILED", "Kunne ikke lese profil.", { message: profErr.message });

    const role = String((prof as any)?.role ?? "");
    const companyId = safeStr((prof as any)?.company_id);

    if (!["company_admin", "superadmin", "admin"].includes(role)) return err(rid, 403, "FORBIDDEN", "Ingen tilgang.");
    if (role === "company_admin" && !companyId) return err(rid, 400, "MISSING_COMPANY", "Mangler company_id.");

    const url = new URL(req.url);
    const date = safeStr(url.searchParams.get("date"));
    const limitRaw = Number(url.searchParams.get("limit") ?? 100);
    const limit = Number.isFinite(limitRaw) ? clamp(limitRaw, 1, 200) : 100;

    // Base query (tilpass til deres schema)
    // Antar deliveries har: id, date, slot, company_id, location_id, status, packed_at, delivered_at
    let q = sb
      .from("deliveries")
      .select("*")
      .order("date", { ascending: false })
      .order("slot", { ascending: true })
      .limit(limit);

    if (date) q = q.eq("date", date);
    if (role === "company_admin") q = q.eq("company_id", companyId);

    const { data, error } = await q;
    if (error) return err(rid, 500, "DB_ERROR", "Kunne ikke hente leveranser.", { message: error.message });

    return ok(rid, { deliveries: data ?? [] });
  } catch (e: any) {
    return err(rid, 500, "UNHANDLED", "Uventet feil.", { message: safeStr(e?.message ?? e) });
  }
}

export async function POST(req: NextRequest) {
  const rid = ridFrom(req);
  return err(rid, 405, "method_not_allowed", "Bruk GET.", { method: "POST" });
}
