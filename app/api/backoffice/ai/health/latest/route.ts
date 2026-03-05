import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const gate = await scopeOr401(request);
  if (gate.ok === false) return gate.res;
  const ctx = gate.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  const supabase = supabaseAdmin();
  const { data: rows, error } = await supabase
    .from("content_health")
    .select("id, page_id, variant_id, score, issues, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return jsonErr(ctx.rid, "Kunne ikke hente health.", 500, "HEALTH_FETCH_FAILED");

  const byPage = new Map<string, { pageId: string; variantId: string | null; score: number; issues: unknown[]; createdAt: string }>();
  for (const r of Array.isArray(rows) ? rows : []) {
    const pageId = r.page_id != null ? String(r.page_id) : "";
    if (byPage.has(pageId)) continue;
    byPage.set(pageId, {
      pageId,
      variantId: r.variant_id != null ? String(r.variant_id) : null,
      score: typeof r.score === "number" ? r.score : 0,
      issues: Array.isArray(r.issues) ? r.issues : [],
      createdAt: r.created_at != null ? String(r.created_at) : "",
    });
    if (byPage.size >= 100) break;
  }

  const list = Array.from(byPage.values());
  return jsonOk(ctx.rid, { ok: true, data: list }, 200);
}
