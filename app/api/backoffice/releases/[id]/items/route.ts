import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { addVariantToRelease, getRelease } from "@/lib/backoffice/content/releasesRepo";

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  return jsonErr(s?.ctx?.rid ?? "rid_missing", "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const roleDeny = requireRoleOr403(s.ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;
  const { id: releaseId } = await context.params;
  if (!releaseId?.trim()) return jsonErr(s.ctx.rid, "Mangler release id.", 400, "BAD_REQUEST");
  let body: unknown;
  try { body = await request.json(); } catch { return jsonErr(s.ctx.rid, "Ugyldig JSON.", 400, "BAD_REQUEST"); }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(s.ctx.rid, "Body må være objekt.", 400, "BAD_REQUEST");
  const variantId = typeof o.variantId === "string" ? o.variantId.trim() : "";
  const pageId = typeof o.pageId === "string" ? o.pageId.trim() : "";
  const locale = o.locale === "en" ? "en" : "nb";
  const environment = o.environment === "staging" ? "staging" : "prod";
  if (!variantId || !pageId) return jsonErr(s.ctx.rid, "Mangler variantId eller pageId.", 400, "BAD_REQUEST");
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    const release = await getRelease(supabase as any, releaseId);
    if (!release) return jsonErr(s.ctx.rid, "Release ikke funnet.", 404, "NOT_FOUND");
    if (release.status !== "draft") return jsonErr(s.ctx.rid, "Kan bare legge til i draft-release.", 400, "BAD_REQUEST");
    const item = await addVariantToRelease(supabase as any, releaseId, variantId, pageId, locale, environment);
    return jsonOk(s.ctx.rid, { ok: true, rid: s.ctx.rid, item }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return jsonErr(s.ctx.rid, message, 500, "SERVER_ERROR", { detail: String(e) });
  }
}