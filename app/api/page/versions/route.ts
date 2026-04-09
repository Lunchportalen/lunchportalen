import type { NextRequest } from "next/server";
import { withCmsPageDocumentGate } from "@/lib/cms/cmsPageDocumentGate";
import {
  extractChangedFieldsFromStoredData,
  fetchPageVersionSnapshot,
  listPageVersions,
  parsePageVersionData,
  snapshotsContentEqual,
} from "@/lib/backoffice/content/pageVersionsRepo";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, q } from "@/lib/http/routeGuard";
import { isLocalCmsRuntimeError, listLocalCmsVersions } from "@/lib/localRuntime/cmsProvider";
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
 * GET /api/page/versions?pageId=...&locale=&environment=
 * Lists content snapshots (newest first). Optional locale/environment filter.
 */
export async function GET(request: NextRequest) {
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  const pageId = q(request, "pageId")?.trim() ?? "";
  if (!pageId) {
    return jsonErr(ctx.rid, "Mangler pageId.", 400, "BAD_REQUEST");
  }
  const localeFilter = q(request, "locale")?.trim() || null;
  const environmentFilter = q(request, "environment")?.trim() || null;

  return withCmsPageDocumentGate("api/page/versions/GET", async () => {
    try {
      if (isLocalCmsRuntimeEnabled()) {
        const out = listLocalCmsVersions({
          pageId,
          locale: localeFilter,
          environment: environmentFilter,
        });
        return jsonOk(ctx.rid, out, 200);
      }

      const supabase = supabaseAdmin();
      const rows = await listPageVersions(supabase as any, pageId, {
        locale: localeFilter,
        environment: environmentFilter,
      });
      const live =
        localeFilter && environmentFilter
          ? await fetchPageVersionSnapshot(supabase as any, pageId, localeFilter, environmentFilter)
          : null;
      const versions = rows.map((r) => {
        const parsed = parsePageVersionData(r.data);
        const isActive = Boolean(live && parsed && snapshotsContentEqual(live, parsed));
        return {
          id: r.id,
          pageId: r.page_id,
          versionNumber: r.version_number,
          locale: r.locale,
          environment: r.environment,
          createdAt: r.created_at,
          createdBy: r.created_by,
          label: r.label ?? "Manuell lagring",
          action: r.action ?? "save",
          changedFields: extractChangedFieldsFromStoredData(r.data),
          isActive,
        };
      });
      return jsonOk(ctx.rid, { versions }, 200);
    } catch (e) {
      if (isLocalCmsRuntimeError(e)) {
        return jsonErr(ctx.rid, e.message, e.status, e.code, e.detail);
      }
      const msg = e instanceof Error ? e.message : "Internal server error";
      return jsonErr(ctx.rid, msg, 500, "SERVER_ERROR", { detail: String(e) });
    }
  });
}
