import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { getRelease, removeVariantFromRelease } from "@/lib/backoffice/content/releasesRepo";

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  return jsonErr(s?.ctx?.rid ?? "rid_missing", "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string; variantId: string }> }) {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const roleDeny = requireRoleOr403(s.ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;
  const { id: releaseId, variantId } = await context.params;
  if (!releaseId?.trim() || !variantId?.trim()) return jsonErr(s.ctx.rid, "Mangler release id eller variantId.", 400, "BAD_REQUEST");
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    const release = await getRelease(supabase as any, releaseId);
    if (!release) return jsonErr(s.ctx.rid, "Release ikke funnet.", 404, "NOT_FOUND");
    if (release.status !== "draft") return jsonErr(s.ctx.rid, "Kan bare fjerne fra draft-release.", 400, "BAD_REQUEST");
    await removeVariantFromRelease(supabase as any, releaseId, variantId);
    return jsonOk(s.ctx.rid, { ok: true, rid: s.ctx.rid }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return jsonErr(s.ctx.rid, message, 500, "SERVER_ERROR", { detail: String(e) });
  }
}