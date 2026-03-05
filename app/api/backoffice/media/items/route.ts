import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { scopeOr401, requireRoleOr403, q: qParam } = await import("@/lib/http/routeGuard");
  const gate = await scopeOr401(request);
  if (gate.ok === false) return gate.res;
  const ctx = gate.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  const source = qParam(request, "source");
  const status = qParam(request, "status");
  const limit = Math.min(parseInt(qParam(request, "limit") ?? "30", 10) || 30, 100);

  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    let query = supabase
      .from("media_items")
      .select("id, type, status, source, url, alt, caption, width, height, mime_type, bytes, tags, metadata, created_by, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (source === "upload" || source === "ai") query = query.eq("source", source);
    if (status === "proposed" || status === "ready" || status === "failed") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return jsonErr(ctx.rid, "Kunne ikke hente medieelementer.", 500, "MEDIA_LIST_FAILED");
    const items = (data ?? []).map((row: Record<string, unknown>) => ({
      id: row.id,
      type: row.type,
      status: row.status,
      source: row.source,
      url: row.url,
      alt: row.alt,
      caption: row.caption,
      width: row.width,
      height: row.height,
      mime_type: row.mime_type,
      bytes: row.bytes,
      tags: row.tags ?? [],
      metadata: row.metadata ?? {},
      created_by: row.created_by,
      created_at: row.created_at,
    }));
    return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, items }, 200);
  } catch (e) {
    return jsonErr(ctx.rid, "Kunne ikke hente medieelementer.", 500, "MEDIA_LIST_FAILED");
  }
}

export async function POST(request: NextRequest) {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const gate = await scopeOr401(request);
  if (gate.ok === false) return gate.res;
  const ctx = gate.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr(ctx.rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!o || typeof o.url !== "string" || !o.url.trim()) {
    return jsonErr(ctx.rid, "Mangler url.", 400, "BAD_REQUEST");
  }
  const url = String(o.url).trim();
  const alt = typeof o.alt === "string" ? o.alt.trim() : "";
  const caption = typeof o.caption === "string" ? o.caption.trim() : null;
  const tags = Array.isArray(o.tags) ? (o.tags as string[]).filter((t) => typeof t === "string") : [];

  const email = ctx.scope?.email ?? "anon";
  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    const { data: inserted, error } = await supabase
      .from("media_items")
      .insert({
        type: "image",
        status: "ready",
        source: "upload",
        url,
        alt,
        caption,
        tags,
        metadata: {},
        created_by: ctx.scope?.email ?? null,
      } as Record<string, unknown>)
      .select("id, type, status, source, url, alt, caption, width, height, mime_type, bytes, tags, metadata, created_by, created_at")
      .single();
    if (error) return jsonErr(ctx.rid, "Kunne ikke opprette medieelement.", 500, "MEDIA_CREATE_FAILED");
    const item = inserted as Record<string, unknown>;
    if (!item) return jsonErr(ctx.rid, "Kunne ikke opprette medieelement.", 500, "MEDIA_CREATE_FAILED");
    return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, item }, 200);
  } catch (e) {
    return jsonErr(ctx.rid, "Kunne ikke opprette medieelement.", 500, "MEDIA_CREATE_FAILED");
  }
}