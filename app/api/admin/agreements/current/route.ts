// app/api/admin/agreements/current/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { noStoreHeaders } from "@/lib/http/noStore";
import { jsonErr, rid as makeRid } from "@/lib/http/respond";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export async function GET(req: NextRequest) {
  const rid = safeStr(req.headers.get("x-rid")) || makeRid();

  try {
    // ✅ Late import – unngår env i build/import
    const { supabaseServer } = await import("@/lib/supabase/server");
    const sb = await supabaseServer();

    // 1) Auth (fail-closed)
    const { data: auth, error: authErr } = await sb.auth.getUser();
    const user = auth?.user ?? null;
    if (authErr || !user) return jsonErr(401, rid, "UNAUTHENTICATED", "Du må være innlogget.");

    // 2) Role check: company_admin eller superadmin (fail-closed)
    const { data: prof, error: profErr } = await sb
      .from("profiles")
      .select("role, company_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profErr) return jsonErr(500, rid, "PROFILE_READ_FAILED", "Kunne ikke lese profil.", { message: profErr.message });

    const role = String((prof as any)?.role ?? "");
    if (role !== "company_admin" && role !== "superadmin") {
      return jsonErr(403, rid, "FORBIDDEN", "Ingen tilgang.");
    }

    const companyId = String((prof as any)?.company_id ?? "");
    if (!companyId && role !== "superadmin") {
      return jsonErr(400, rid, "MISSING_COMPANY", "Mangler company_id.");
    }

    // 3) Hent siste avtale for firma
    const q = sb
      .from("agreements")
      .select("*")
      .order("start_date", { ascending: false })
      .limit(1);

    const { data, error } =
      role === "superadmin" && !companyId
        ? await q.maybeSingle()
        : await q.eq("company_id", companyId).maybeSingle();

    if (error) return jsonErr(500, rid, "DB_ERROR", "Kunne ikke hente avtale.", { message: error.message });

    return NextResponse.json(
      { ok: true, rid, agreement: data ?? null },
      { status: 200, headers: noStoreHeaders() }
    );
  } catch (e: any) {
    return jsonErr(500, rid, "INTERNAL_ERROR", "Uventet feil.", { message: safeStr(e?.message ?? e) });
  }
}
