import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { getScheduledReleaseForVariant } from "@/lib/backoffice/content/releasesRepo";

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  return jsonErr(s?.ctx?.rid ?? "rid_missing", "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { scopeOr401, requireRoleOr403, q: qParam } = await import("@/lib/http/routeGuard");
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const roleDeny = requireRoleOr403(s.ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;
  const variantId = qParam(request, "variantId") ?? "";
  if (!variantId.trim()) return jsonErr(s.ctx.rid, "Mangler variantId.", 400, "BAD_REQUEST");
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    const releaseId = await getScheduledReleaseForVariant(supabase as any, variantId);
    return jsonOk(s.ctx.rid, {
      ok: true,
      rid: s.ctx.rid,
      inScheduledRelease: !!releaseId,
      releaseId: releaseId ?? undefined,
    }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return jsonErr(s.ctx.rid, message, 500, "SERVER_ERROR", { detail: String(e) });
  }
}