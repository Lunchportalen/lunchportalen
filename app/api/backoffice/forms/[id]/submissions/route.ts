import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";

function deny(s: { response?: Response; res?: Response; ctx?: { rid: string } }) {
  if (s?.response) return s.response; if (s?.res) return s.res;
  return jsonErr(s?.ctx?.rid ?? "r", "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { scopeOr401, requireRoleOr403, q: qParam } = await import("@/lib/http/routeGuard");
  const s = await scopeOr401(request);
  if (!s?.ok) return deny(s);
  const roleDeny = requireRoleOr403(s.ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;
  const { id } = await context.params;
  const limit = Math.min(parseInt(qParam(request, "limit") ?? "50", 10) || 50, 100);
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("form_submissions").select("id, form_id, environment, locale, data, created_at")
      .eq("form_id", id).order("created_at", { ascending: false }).limit(limit);
    if (error) throw new Error(error.message);
    return jsonOk(s.ctx.rid, { ok: true, rid: s.ctx.rid, submissions: data ?? [] }, 200);
  } catch (e) {
    return jsonErr(s.ctx.rid, e instanceof Error ? e.message : "Error", 500, "SERVER_ERROR");
  }
}
