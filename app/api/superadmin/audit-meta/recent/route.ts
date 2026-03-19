export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { scopeOr401, requireRoleOr403, denyResponse } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";

export async function GET(req: NextRequest) {
  const s = await scopeOr401(req);
  if (s.ok === false) return denyResponse(s);
  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  const { supabaseServer } = await import("@/lib/supabase/server");
  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "10");
  const limit = Math.max(1, Math.min(50, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 10));

  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("audit_meta_events")
    .select("id,created_at,actor_email,action,purpose,entity_type,entity_id,rid,detail")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return jsonErr(ctx.rid, "Kunne ikke hente audit-meta.", 500, "DB_ERROR", { detail: error });
  return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, items: data ?? [] }, 200);
}
