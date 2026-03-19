/**
 * Returns the published (prod) variant body for a page.
 * Used by the editor to compare preview vs published and show "differs" indicator.
 * Same contract as getContentBySlug: prod variant, locale nb.
 */
import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  return jsonErr(s?.ctx?.rid ?? "rid_missing", "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const roleDeny = requireRoleOr403(s.ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;
  const { id: pageId } = await context.params;
  if (!pageId?.trim()) return jsonErr(s.ctx.rid, "Mangler page id.", 400, "BAD_REQUEST");
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    const { data: variant, error } = await supabase
      .from("content_page_variants")
      .select("id, body")
      .eq("page_id", pageId)
      .eq("locale", "nb")
      .eq("environment", "prod")
      .maybeSingle();
    if (error) throw error;
    if (!variant) return jsonErr(s.ctx.rid, "Ingen publisert variant.", 404, "NOT_FOUND");
    return jsonOk(s.ctx.rid, { ok: true, body: variant.body ?? null }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return jsonErr(s.ctx.rid, message, 500, "SERVER_ERROR", { detail: String(e) });
  }
}
