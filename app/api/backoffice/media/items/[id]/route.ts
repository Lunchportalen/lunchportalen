import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const gate = await scopeOr401(request);
  if (gate.ok === false) return gate.res;
  const ctx = gate.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  const { id } = await context.params;
  if (!id?.trim()) return jsonErr(ctx.rid, "Mangler id.", 400, "BAD_REQUEST");

  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("media_items")
      .select("id, type, status, source, url, alt, caption, width, height, mime_type, bytes, tags, metadata, created_by, created_at")
      .eq("id", id)
      .maybeSingle();
    if (error) return jsonErr(ctx.rid, "Kunne ikke hente medieelement.", 500, "MEDIA_READ_FAILED");
    if (!data) return jsonErr(ctx.rid, "Medieelement ikke funnet.", 404, "NOT_FOUND");
    const row = data as Record<string, unknown>;
    return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, item: { ...row, tags: row.tags ?? [], metadata: row.metadata ?? {} } }, 200);
  } catch (e) {
    return jsonErr(ctx.rid, "Kunne ikke hente medieelement.", 500, "MEDIA_READ_FAILED");
  }
}

const ALT_MAX = 180;
const CAPTION_MAX = 500;
const TAGS_MAX_COUNT = 20;
const TAG_MAX_LEN = 30;

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  proposed: ["ready", "failed"],
  failed: ["ready"],
  ready: ["ready"],
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
  const gate = await scopeOr401(request);
  if (gate.ok === false) return gate.res;
  const ctx = gate.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  const { id } = await context.params;
  if (!id?.trim()) return jsonErr(ctx.rid, "Mangler id.", 400, "BAD_REQUEST");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr(ctx.rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(ctx.rid, "Body må være et objekt.", 400, "BAD_REQUEST");

  const altRaw = o.alt;
  const captionRaw = o.caption;
  const tagsRaw = o.tags;
  const statusRaw = o.status;

  const updates: Record<string, unknown> = {};

  if (altRaw !== undefined) {
    const alt = typeof altRaw === "string" ? altRaw.trim() : "";
    if (alt.length > ALT_MAX) return jsonErr(ctx.rid, "Alt maks " + ALT_MAX + " tegn.", 400, "VALIDATION_ERROR");
    updates.alt = alt;
  }
  if (captionRaw !== undefined) {
    const caption = captionRaw === null ? null : (typeof captionRaw === "string" ? captionRaw.trim() : "");
    if (caption !== null && caption.length > CAPTION_MAX)
      return jsonErr(ctx.rid, "Caption maks " + CAPTION_MAX + " tegn.", 400, "VALIDATION_ERROR");
    updates.caption = caption;
  }
  if (tagsRaw !== undefined) {
    if (!Array.isArray(tagsRaw)) return jsonErr(ctx.rid, "tags må være array.", 400, "VALIDATION_ERROR");
    const tags = (tagsRaw as unknown[])
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length > TAGS_MAX_COUNT) return jsonErr(ctx.rid, "Maks " + TAGS_MAX_COUNT + " tags.", 400, "VALIDATION_ERROR");
    for (const t of tags) {
      if (t.length > TAG_MAX_LEN) return jsonErr(ctx.rid, "Hver tag maks " + TAG_MAX_LEN + " tegn.", 400, "VALIDATION_ERROR");
    }
    updates.tags = tags;
  }
  if (statusRaw !== undefined) {
    const nextStatus = statusRaw === "proposed" || statusRaw === "ready" || statusRaw === "failed" ? statusRaw : null;
    if (nextStatus === null) return jsonErr(ctx.rid, "Ugyldig status.", 400, "VALIDATION_ERROR");
    updates.status = nextStatus;
  }

  if (Object.keys(updates).length === 0) {
    return jsonErr(ctx.rid, "Ingen felter å oppdatere.", 400, "BAD_REQUEST");
  }

  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    const { data: existing, error: fetchErr } = await supabase
      .from("media_items")
      .select("id, status")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr) return jsonErr(ctx.rid, "Kunne ikke hente medieelement.", 500, "MEDIA_READ_FAILED");
    if (!existing) return jsonErr(ctx.rid, "Medieelement ikke funnet.", 404, "NOT_FOUND");

    const currentStatus = (existing as { status: string }).status;
    if (updates.status !== undefined) {
      const allowed = ALLOWED_TRANSITIONS[currentStatus];
      if (!allowed || !allowed.includes(updates.status as string))
        return jsonErr(ctx.rid, "Ugyldig statustransisjon.", 400, "INVALID_STATUS_TRANSITION");
    }

    const { data: updated, error: updateErr } = await supabase
      .from("media_items")
      .update(updates as Record<string, unknown>)
      .eq("id", id)
      .select("id, type, status, source, url, alt, caption, width, height, mime_type, bytes, tags, metadata, created_by, created_at")
      .single();
    if (updateErr) return jsonErr(ctx.rid, "Kunne ikke oppdatere medieelement.", 500, "MEDIA_UPDATE_FAILED");
    const row = updated as Record<string, unknown>;
    return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, item: { ...row, tags: row.tags ?? [], metadata: row.metadata ?? {} } }, 200);
  } catch (e) {
    return jsonErr(ctx.rid, "Kunne ikke oppdatere medieelement.", 500, "MEDIA_UPDATE_FAILED");
  }
}