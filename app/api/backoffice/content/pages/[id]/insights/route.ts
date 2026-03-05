import type { NextRequest } from "next/server";

import { jsonErr, jsonOk } from "@/lib/http/respond";

const ENVS = ["prod", "staging"] as const;
const LOCALES = ["nb", "en"] as const;

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { scopeOr401, requireRoleOr403, q: qParam } = await import("@/lib/http/routeGuard");

  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;

  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  const { id } = await context.params;
  const localeRaw = qParam(request, "locale") ?? "nb";
  const envRaw = qParam(request, "env") ?? "prod";
  const locale = LOCALES.includes(localeRaw as (typeof LOCALES)[number]) ? localeRaw : "nb";
  const env = ENVS.includes(envRaw as (typeof ENVS)[number]) ? envRaw : "prod";

  if (!id?.trim()) {
    return jsonErr(ctx.rid, "Mangler page id.", 400, "BAD_REQUEST");
  }

  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();

    const now = new Date();
    const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const pageId = id.trim();

    const [view7, view30, cta7, cta30, search7, search30] = await Promise.all([
      supabase.from("content_analytics_events").select("*", { count: "exact", head: true }).eq("event_type", "page_view").eq("page_id", pageId).eq("environment", env).eq("locale", locale).gte("created_at", since7),
      supabase.from("content_analytics_events").select("*", { count: "exact", head: true }).eq("event_type", "page_view").eq("page_id", pageId).eq("environment", env).eq("locale", locale).gte("created_at", since30),
      supabase.from("content_analytics_events").select("*", { count: "exact", head: true }).eq("event_type", "cta_click").eq("page_id", pageId).eq("environment", env).eq("locale", locale).gte("created_at", since7),
      supabase.from("content_analytics_events").select("*", { count: "exact", head: true }).eq("event_type", "cta_click").eq("page_id", pageId).eq("environment", env).eq("locale", locale).gte("created_at", since30),
      supabase.from("content_analytics_events").select("*", { count: "exact", head: true }).eq("event_type", "search").eq("environment", env).eq("locale", locale).gte("created_at", since7),
      supabase.from("content_analytics_events").select("*", { count: "exact", head: true }).eq("event_type", "search").eq("environment", env).eq("locale", locale).gte("created_at", since30),
    ]);

    const last7Views = view7.count ?? 0;
    const last30Views = view30.count ?? 0;
    const last7Cta = cta7.count ?? 0;
    const last30Cta = cta30.count ?? 0;
    const last7Searches = search7.count ?? 0;
    const last30Searches = search30.count ?? 0;

    const [ctaRows, searchRows] = await Promise.all([
      supabase.from("content_analytics_events").select("event_key").eq("event_type", "cta_click").eq("page_id", pageId).eq("environment", env).eq("locale", locale).gte("created_at", since30),
      supabase.from("content_analytics_events").select("event_value").eq("event_type", "search").eq("environment", env).eq("locale", locale).gte("created_at", since30),
    ]);

    const ctaCounts = new Map<string, number>();
    for (const row of ctaRows.data ?? []) {
      const k = row.event_key ?? "";
      ctaCounts.set(k, (ctaCounts.get(k) ?? 0) + 1);
    }
    const ctaTop = Array.from(ctaCounts.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const searchCounts = new Map<string, number>();
    for (const row of searchRows.data ?? []) {
      const q = row.event_value ?? "";
      searchCounts.set(q, (searchCounts.get(q) ?? 0) + 1);
    }
    const searchTop = Array.from(searchCounts.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, views: { last7: last7Views, last30: last30Views }, ctaClicks: { last7: last7Cta, last30: last30Cta, top: ctaTop }, searches: { last7: last7Searches, last30: last30Searches, top: searchTop } }, 200);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return jsonErr(ctx.rid, message, 500, "SERVER_ERROR", { detail: String(e) });
  }
}