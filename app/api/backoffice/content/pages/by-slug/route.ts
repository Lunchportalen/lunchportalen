import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { scopeOr401, requireRoleOr403, denyResponse } from "@/lib/http/routeGuard";
import { getLocalDevContentReservePageBySlug, isLocalDevContentReserveEnabled } from "@/lib/cms/contentLocalDevReserve";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { listLocalCmsTreePages } from "@/lib/localRuntime/cmsProvider";
import { isLocalCmsRuntimeEnabled } from "@/lib/localRuntime/runtime";

export async function GET(request: NextRequest) {
  const s = await scopeOr401(request);
  if (s.ok === false) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  const slug = request.nextUrl.searchParams.get("slug");
  const slugNorm = typeof slug === "string" ? slug.trim() : "";
  if (!slugNorm) return jsonErr(ctx.rid, "Mangler slug.", 400, "BAD_REQUEST");

  try {
    if (isLocalCmsRuntimeEnabled()) {
      const row = listLocalCmsTreePages().find((page) => page.slug === slugNorm) ?? null;
      if (!row?.id) return jsonErr(ctx.rid, "Finner ikke side med denne slug.", 404, "NOT_FOUND");
      return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, data: { id: row.id } }, 200);
    }

    if (isLocalDevContentReserveEnabled()) {
      const row = getLocalDevContentReservePageBySlug(slugNorm);
      if (!row?.id) return jsonErr(ctx.rid, "Finner ikke side med denne slug.", 404, "NOT_FOUND");
      return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, data: { id: row.id } }, 200);
    }

    const supabase = supabaseAdmin();
    const { data: row, error } = await supabase
      .from("content_pages")
      .select("id")
      .eq("slug", slugNorm)
      .maybeSingle();

    if (error) throw error;
    if (!row?.id) return jsonErr(ctx.rid, "Finner ikke side med denne slug.", 404, "NOT_FOUND");
    return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, data: { id: row.id } }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Kunne ikke slå opp side.";
    return jsonErr(ctx.rid, msg, 500, "SERVER_ERROR", { detail: String(e) });
  }
}