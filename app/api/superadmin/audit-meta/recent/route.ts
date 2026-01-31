

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getScope } from "@/lib/auth/scope";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function rid() {
  return crypto.randomBytes(8).toString("hex");
}
function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}
function jsonErr(status: number, rid: string, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}

async function requireSuperadmin(req: NextRequest) {
  const scope = await getScope(req);
  if (!scope?.user_id) throw new Error("NOT_AUTHENTICATED");
  if (scope.role !== "superadmin") throw new Error("FORBIDDEN");
  return scope;
}

export async function GET(req: NextRequest) {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const r = rid();
  try {
    await requireSuperadmin(req);

    const url = new URL(req.url);
    const limitRaw = Number(url.searchParams.get("limit") ?? "10");
    const limit = Math.max(1, Math.min(50, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 10));

    const sb = await supabaseServer();
    const { data, error } = await sb
      .from("audit_meta_events")
      .select("id,created_at,actor_email,action,purpose,entity_type,entity_id,rid,detail")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return jsonErr(500, r, "DB_ERROR", "Kunne ikke hente audit-meta.", error);

    return jsonOk({ ok: true, rid: r, items: data ?? [] });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg === "NOT_AUTHENTICATED") return jsonErr(401, r, "UNAUTHENTICATED", "Du må være innlogget.");
    if (msg === "FORBIDDEN") return jsonErr(403, r, "FORBIDDEN", "Kun superadmin har tilgang.");
    return jsonErr(500, r, "SERVER_ERROR", "Ukjent feil ved henting av audit-meta.", { msg });
  }
}



