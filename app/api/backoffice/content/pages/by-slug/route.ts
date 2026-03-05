import type { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk } from "@/lib/http/respond";

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function GET(request: NextRequest) {
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const { ctx } = s;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  const slug = request.nextUrl.searchParams.get("slug");
  const slugNorm = typeof slug === "string" ? slug.trim() : "";
  if (!slugNorm) return jsonErr(ctx.rid, "Mangler slug.", 400, "BAD_REQUEST");

  try {
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