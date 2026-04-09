/**
 * Media get/update/delete by id. Authorization: superadmin only.
 * scopeOr401 → 401 if unauthenticated; requireRoleOr403 → 403 if not superadmin.
 */
import type { NextRequest } from "next/server";
import { jsonErr, jsonNotFound, jsonOk } from "@/lib/http/respond";
import { isMediaItemUuid } from "@/lib/media/ids";
import { getMediaItemById } from "@/lib/media/loaders";
import { rowToMediaItem, mediaItemSelectColumns } from "@/lib/media/normalize";
import { normalizeVariantsMap } from "@/lib/media/variantResolution";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { scopeOr401, requireRoleOr403, denyResponse } = await import("@/lib/http/routeGuard");
  const s = await scopeOr401(request);
  if (s.ok === false) return denyResponse(s);
  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  const { id } = await context.params;
  const tid = id?.trim();
  if (!tid) return jsonErr(ctx.rid, "Mangler id.", 400, "BAD_REQUEST");
  if (!isMediaItemUuid(tid)) return jsonErr(ctx.rid, "Ugyldig medie-id.", 400, "BAD_REQUEST");

  try {
    const item = await getMediaItemById(tid);
    if (!item) return jsonNotFound(ctx.rid, "Medieelement ikke funnet.");
    return jsonOk(ctx.rid, { item }, 200);
  } catch (e) {
    return jsonErr(ctx.rid, "Kunne ikke hente medieelement.", 500, "MEDIA_READ_FAILED");
  }
}

const DISPLAY_NAME_MAX = 120;
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
  const { scopeOr401, requireRoleOr403, denyResponse } = await import("@/lib/http/routeGuard");
  const s = await scopeOr401(request);
  if (s.ok === false) return denyResponse(s);
  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  const { id } = await context.params;
  const tid = id?.trim();
  if (!tid) return jsonErr(ctx.rid, "Mangler id.", 400, "BAD_REQUEST");
  if (!isMediaItemUuid(tid)) return jsonErr(ctx.rid, "Ugyldig medie-id.", 400, "BAD_REQUEST");

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
  const metadataRaw = o.metadata;
  const displayNameRaw = o.displayName;

  const updates: Record<string, unknown> = {};

  if (metadataRaw !== undefined) {
    if (metadataRaw !== null && typeof metadataRaw !== "object") {
      return jsonErr(ctx.rid, "metadata må være et objekt.", 400, "VALIDATION_ERROR");
    }
    updates.metadata = metadataRaw && typeof metadataRaw === "object" ? (metadataRaw as Record<string, unknown>) : {};
  }

  if (displayNameRaw !== undefined) {
    const dn = typeof displayNameRaw === "string" ? displayNameRaw.trim().slice(0, DISPLAY_NAME_MAX) : "";
    const cur = (updates.metadata as Record<string, unknown> | undefined) ?? {};
    if (dn) cur.displayName = dn;
    else delete cur.displayName;
    updates.metadata = cur;
  }

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
    const selectCols = updates.metadata !== undefined ? "id, status, metadata" : "id, status";
    const { data: existing, error: fetchErr } = await supabase
      .from("media_items")
      .select(selectCols)
      .eq("id", tid)
      .maybeSingle();
    if (fetchErr) return jsonErr(ctx.rid, "Kunne ikke hente medieelement.", 500, "MEDIA_READ_FAILED");
    if (!existing) return jsonNotFound(ctx.rid, "Medieelement ikke funnet.");

    const existingRow = existing as unknown as { status: string; metadata?: Record<string, unknown> };
    const currentStatus = existingRow.status;
    if (updates.status !== undefined) {
      const allowed = ALLOWED_TRANSITIONS[currentStatus];
      if (!allowed || !allowed.includes(updates.status as string))
        return jsonErr(ctx.rid, "Ugyldig statustransisjon.", 400, "INVALID_STATUS_TRANSITION");
    }

    if (updates.metadata !== undefined) {
      const existingMeta = existingRow.metadata ?? {};
      const merged = { ...existingMeta, ...(updates.metadata as Record<string, unknown>) };
      if (merged.variants !== undefined) {
        const n = normalizeVariantsMap(merged.variants);
        if (n) merged.variants = n;
        else delete merged.variants;
      }
      updates.metadata = merged;
    }

    const { data: updated, error: updateErr } = await supabase
      .from("media_items")
      .update(updates as Record<string, unknown>)
      .eq("id", tid)
      .select(mediaItemSelectColumns)
      .single();
    if (updateErr) return jsonErr(ctx.rid, "Kunne ikke oppdatere medieelement.", 500, "MEDIA_UPDATE_FAILED");
    const item = rowToMediaItem(updated as Record<string, unknown>);
    if (!item) return jsonErr(ctx.rid, "Kunne ikke oppdatere medieelement.", 500, "MEDIA_UPDATE_FAILED");
    return jsonOk(ctx.rid, { item }, 200);
  } catch (e) {
    return jsonErr(ctx.rid, "Kunne ikke oppdatere medieelement.", 500, "MEDIA_UPDATE_FAILED");
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { scopeOr401, requireRoleOr403, denyResponse } = await import("@/lib/http/routeGuard");
  const s = await scopeOr401(request);
  if (s.ok === false) return denyResponse(s);
  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  const { id } = await context.params;
  const tid = id?.trim();
  if (!tid) return jsonErr(ctx.rid, "Mangler id.", 400, "BAD_REQUEST");
  if (!isMediaItemUuid(tid)) return jsonErr(ctx.rid, "Ugyldig medie-id.", 400, "BAD_REQUEST");

  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    const { error } = await supabase.from("media_items").delete().eq("id", tid);
    if (error) return jsonErr(ctx.rid, "Kunne ikke slette medieelement.", 500, "MEDIA_DELETE_FAILED");
    return jsonOk(ctx.rid, { deleted: true }, 200);
  } catch (e) {
    return jsonErr(ctx.rid, "Kunne ikke slette medieelement.", 500, "MEDIA_DELETE_FAILED");
  }
}
