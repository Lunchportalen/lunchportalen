

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { getScope } from "@/lib/auth/scope";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

async function requireSuperadmin(req: NextRequest) {
  const scope = await getScope(req);
  if (!scope?.user_id) throw new Error("NOT_AUTHENTICATED");
  if (scope.role !== "superadmin") throw new Error("FORBIDDEN");
  return scope;
}

export async function GET(req: NextRequest) {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const r = makeRid();
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

    if (error) return jsonErr(r, "Kunne ikke hente audit-meta.", 500, { code: "DB_ERROR", detail: error });

    return jsonOk(r, { ok: true, rid: r, items: data ?? [] }, 200);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg === "NOT_AUTHENTICATED") return jsonErr(r, "Du må være innlogget.", 401, "UNAUTHENTICATED");
    if (msg === "FORBIDDEN") return jsonErr(r, "Kun superadmin har tilgang.", 403, "FORBIDDEN");
    return jsonErr(r, "Ukjent feil ved henting av audit-meta.", 500, { code: "SERVER_ERROR", detail: { msg } });
  }
}


