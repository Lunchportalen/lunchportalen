// app/api/admin/agreements/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { noStoreHeaders } from "@/lib/http/noStore";
import { jsonErr, rid as makeRid } from "@/lib/http/respond";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * GET /api/admin/agreements
 * - Firma-admin/superadmin
 * - Runtime-only (Supabase/env)
 * - Returnerer avtaler for firma (company_admin) eller siste N (superadmin)
 *
 * Query (valgfritt):
 *  - limit: 1..200 (default 50)
 */
export async function GET(req: NextRequest) {
  const rid = safeStr(req.headers.get("x-rid")) || makeRid();

  try {
    // ✅ Late import: hindrer env-evaluering under next build
    const { supabaseServer } = await import("@/lib/supabase/server");
  const sb = await supabaseServer();

    // Auth (fail-closed)
    const { data: auth, error: authErr } = await sb.auth.getUser();
    const user = auth?.user ?? null;
    if (authErr || !user) {
      return jsonErr(401, rid, "UNAUTHENTICATED", "Du må være innlogget.");
    }

    // Profil / rolle + company
    const { data: prof, error: profErr } = await sb
      .from("profiles")
      .select("role, company_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profErr) {
      return jsonErr(500, rid, "PROFILE_READ_FAILED", "Kunne ikke lese profil.", { message: profErr.message });
    }

    const role = String((prof as any)?.role ?? "");
    const companyId = String((prof as any)?.company_id ?? "");

    if (role !== "company_admin" && role !== "superadmin") {
      return jsonErr(403, rid, "FORBIDDEN", "Ingen tilgang.");
    }

    const url = new URL(req.url);
    const limitRaw = Number(url.searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(limitRaw) ? clamp(limitRaw, 1, 200) : 50;

    // Query
    let q = sb.from("agreements").select("*").order("start_date", { ascending: false }).limit(limit);

    if (role === "company_admin") {
      if (!companyId) {
        return jsonErr(400, rid, "MISSING_COMPANY", "Mangler company_id.");
      }
      q = q.eq("company_id", companyId);
    }

    const { data, error } = await q;

    if (error) {
      return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente avtaler.", { message: error.message });
    }

    return NextResponse.json(
      { ok: true, rid, agreements: data ?? [] },
      { status: 200, headers: noStoreHeaders() }
    );
  } catch (e: any) {
    return jsonErr(500, rid, "INTERNAL_ERROR", "Uventet feil.", { message: safeStr(e?.message ?? e) });
  }
}


