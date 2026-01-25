// app/api/admin/employees/invites/stats/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}

function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}

function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

export async function GET(req: Request) {
  const rid = `inv_stats_${Math.random().toString(16).slice(2)}`;

  try {
    const url = new URL(req.url);
    const companyId = url.searchParams.get("companyId");

    if (!isUuid(companyId)) return jsonError(400, "bad_request", "Mangler/ugyldig companyId.", { rid });

    const sb = await supabaseServer(); // ✅ IMPORTANT
    const nowIso = new Date().toISOString();

    const totalQ = sb.from("employee_invites").select("id", { count: "exact", head: true }).eq("company_id", companyId);

    const activeQ = sb
      .from("employee_invites")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("used_at", null)
      .gt("expires_at", nowIso);

    const usedQ = sb
      .from("employee_invites")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .not("used_at", "is", null);

    const expiredQ = sb
      .from("employee_invites")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("used_at", null)
      .lt("expires_at", nowIso);

    const [totalR, activeR, usedR, expiredR] = await Promise.all([totalQ, activeQ, usedQ, expiredQ]);

    const anyErr = totalR.error || activeR.error || usedR.error || expiredR.error;
    if (anyErr) return jsonError(500, "db_error", "Kunne ikke hente invitasjonsstatistikk.", { rid, anyErr });

    return jsonOk({
      ok: true,
      rid,
      stats: {
        total: Number(totalR.count ?? 0),
        active: Number(activeR.count ?? 0),
        used: Number(usedR.count ?? 0),
        expired: Number(expiredR.count ?? 0),
      },
    });
  } catch (e: any) {
    return jsonError(500, "server_error", "Uventet feil.", { rid, message: String(e?.message ?? e) });
  }
}
