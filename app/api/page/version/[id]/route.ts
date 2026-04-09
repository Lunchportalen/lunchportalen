import type { NextRequest } from "next/server";
import { withCmsPageDocumentGate } from "@/lib/cms/cmsPageDocumentGate";
import { getPageVersionById, parsePageVersionData } from "@/lib/backoffice/content/pageVersionsRepo";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, q } from "@/lib/http/routeGuard";
import { getLocalCmsVersionPreview, isLocalCmsRuntimeError } from "@/lib/localRuntime/cmsProvider";
import { isLocalCmsRuntimeEnabled } from "@/lib/localRuntime/runtime";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

/**
 * GET /api/page/version/[id]?pageId=...
 * Returns parsed snapshot for preview (read-only; does not persist).
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  const { id: versionId } = await context.params;
  const pageId = q(request, "pageId")?.trim() ?? "";
  if (!versionId?.trim() || !pageId) {
    return jsonErr(ctx.rid, "Mangler version id eller pageId.", 400, "BAD_REQUEST");
  }

  return withCmsPageDocumentGate("api/page/version/[id]/GET", async () => {
    try {
      if (isLocalCmsRuntimeEnabled()) {
        const out = getLocalCmsVersionPreview({ pageId, versionId: versionId.trim() });
        return jsonOk(ctx.rid, out, 200);
      }

      const supabase = supabaseAdmin();
      const row = await getPageVersionById(supabase as any, versionId.trim());
      if (!row || row.page_id !== pageId) {
        return jsonErr(ctx.rid, "Versjon ikke funnet.", 404, "NOT_FOUND");
      }
      if (row.data == null || typeof row.data !== "object") {
        return jsonErr(ctx.rid, "Versjonen mangler data.", 422, "MISSING_VERSION_DATA");
      }
      const parsed = parsePageVersionData(row.data);
      if (!parsed) {
        return jsonErr(ctx.rid, "Ugyldig versjonsdata.", 422, "INVALID_VERSION_DATA");
      }

      return jsonOk(
        ctx.rid,
        {
          preview: {
            versionId: row.id,
            versionNumber: row.version_number,
            label: row.label ?? "Manuell lagring",
            title: parsed.page.title,
            slug: parsed.page.slug,
            status: parsed.page.status,
            published_at: parsed.page.published_at,
            body: parsed.body,
            changedFields: parsed.changedFields ?? [],
          },
        },
        200,
      );
    } catch (e) {
      if (isLocalCmsRuntimeError(e)) {
        return jsonErr(ctx.rid, e.message, e.status, e.code, e.detail);
      }
      const msg = e instanceof Error ? e.message : "Internal server error";
      return jsonErr(ctx.rid, msg, 500, "SERVER_ERROR", { detail: String(e) });
    }
  });
}
