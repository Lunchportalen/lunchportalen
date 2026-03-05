import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const gate = await scopeOr401(request);
  if (gate.ok === false) return gate.res;
  const ctx = gate.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  const url = request.nextUrl;
  const pageId = url.searchParams.get("pageId");
  const variantId = url.searchParams.get("variantId");
  const limitRaw = url.searchParams.get("limit");
  let limit = Number(limitRaw || "20");
  if (!Number.isFinite(limit) || limit <= 0) limit = 20;
  if (limit > 50) limit = 50;

  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    let query = supabase
      .from("ai_suggestions")
      .select("id, tool, status, created_at, environment, locale, page_id, variant_id")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (pageId) query = query.eq("page_id", pageId);
    if (variantId) query = query.eq("variant_id", variantId);

    const { data, error } = await query;
    if (error) {
      return jsonErr(ctx.rid, "Kunne ikke hente AI-forslag.", 500, "AI_SUGGESTIONS_LIST_FAILED", error);
    }

    const items = (data ?? []).map((row: any) => ({
      id: row.id as string,
      tool: row.tool as string,
      status: row.status as string,
      createdAt: row.created_at as string,
      environment: row.environment as string,
      locale: row.locale as string,
      pageId: row.page_id as string | null,
      variantId: row.variant_id as string | null,
    }));

    return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, items }, 200);
  } catch (e) {
    return jsonErr(ctx.rid, "Kunne ikke hente AI-forslag.", 500, "AI_SUGGESTIONS_LIST_FAILED", e);
  }
}