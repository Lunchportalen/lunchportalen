/**
 * Media list/create API. Authorization: superadmin only.
 * scopeOr401 → 401 if unauthenticated; requireRoleOr403 → 403 if not superadmin.
 */
import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, denyResponse, q as qParam } from "@/lib/http/routeGuard";
import { rowToMediaItem, mediaItemSelectColumns } from "@/lib/media/normalize";
import {
  validateMediaUrl,
  MEDIA_ALT_MAX,
  MEDIA_CAPTION_MAX,
  MEDIA_TAGS_MAX_COUNT,
  MEDIA_TAG_MAX_LEN,
} from "@/lib/media/validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Serialize error for logging/detail; never "[object Object]". */
function serializeError(e: unknown): string {
  if (e == null) return "Unknown error";
  if (e instanceof Error) return e.message || e.name || "Error";
  if (typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  try {
    const s = JSON.stringify(e);
    return s.length > 500 ? s.slice(0, 500) + "…" : s;
  } catch {
    return String(e);
  }
}

/** True if error indicates missing media_items table (e.g. migration not applied). */
function isMissingTableError(e: unknown): boolean {
  const code = typeof (e as { code?: string })?.code === "string" ? (e as { code: string }).code : "";
  const msg = serializeError(e).toLowerCase();
  return code === "42P01" || msg.includes("does not exist") || (msg.includes("relation") && msg.includes("media_items"));
}

function logMediaListIncident(ctx: { rid: string }, message: string, error: string, code?: string): void {
  try {
    import("@/lib/ops/log").then(({ opsLog }) => {
      opsLog("incident", {
        rid: ctx.rid,
        route: "/api/backoffice/media/items",
        message,
        error,
        code: code ?? undefined,
      });
    }).catch(() => {});
  } catch {
    // ignore
  }
}

export async function GET(request: NextRequest) {
  const s = await scopeOr401(request);
  if (s.ok === false) return denyResponse(s);
  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  const source = qParam(request, "source");
  const status = qParam(request, "status");
  const limit = Math.min(parseInt(qParam(request, "limit") ?? "30", 10) || 30, 100);
  const offset = Math.max(0, parseInt(qParam(request, "offset") ?? "0", 10) || 0);

  try {
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    let query = supabase
      .from("media_items")
      .select(mediaItemSelectColumns)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (source === "upload" || source === "ai") query = query.eq("source", source);
    if (status === "proposed" || status === "ready" || status === "failed") query = query.eq("status", status);

    const { data, error } = await query;

    if (error) {
      const detailMsg = serializeError(error);
      const code = typeof (error as { code?: string })?.code === "string" ? (error as { code: string }).code : undefined;
      if (isMissingTableError(error)) {
        logMediaListIncident(ctx, "media_items table missing or inaccessible; returning empty list", detailMsg, code);
        return jsonOk(ctx.rid, { items: [] }, 200);
      }
      logMediaListIncident(ctx, "Kunne ikke hente medieelementer.", detailMsg, code);
      return jsonErr(ctx.rid, "Kunne ikke hente medieelementer.", 500, "MEDIA_LIST_FAILED", { detail: detailMsg, code });
    }

    const rawRows = Array.isArray(data) ? data : [];
    const items = rawRows
      .map((row: Record<string, unknown>) => rowToMediaItem(row))
      .filter((item): item is NonNullable<typeof item> => item != null);
    return jsonOk(ctx.rid, { items }, 200);
  } catch (e) {
    const detailMsg = serializeError(e);
    const code = typeof (e as { code?: string })?.code === "string" ? (e as { code: string }).code : undefined;
    if (isMissingTableError(e)) {
      logMediaListIncident(ctx, "media_items table missing or inaccessible; returning empty list", detailMsg, code);
      return jsonOk(ctx.rid, { items: [] }, 200);
    }
    logMediaListIncident(ctx, "Kunne ikke hente medieelementer.", detailMsg, code);
    return jsonErr(ctx.rid, detailMsg || "Kunne ikke hente medieelementer.", 500, "MEDIA_LIST_FAILED", { detail: detailMsg, code });
  }
}

export async function POST(request: NextRequest) {
  const s = await scopeOr401(request);
  if (s.ok === false) return denyResponse(s);
  const ctx = s.ctx;
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
  const urlCheck = validateMediaUrl(url);
  if (!urlCheck.ok) {
    const err = urlCheck as { ok: false; message: string; code: string };
    return jsonErr(ctx.rid, err.message, 400, err.code);
  }

  const altRaw = typeof o.alt === "string" ? o.alt.trim() : "";
  if (altRaw.length > MEDIA_ALT_MAX) {
    return jsonErr(ctx.rid, "Alt maks " + MEDIA_ALT_MAX + " tegn.", 400, "VALIDATION_ERROR");
  }
  const alt = altRaw;

  const captionRaw = typeof o.caption === "string" ? o.caption.trim() : null;
  const caption =
    captionRaw === null || captionRaw === "" ? null : captionRaw;
  if (caption !== null && caption.length > MEDIA_CAPTION_MAX) {
    return jsonErr(ctx.rid, "Caption maks " + MEDIA_CAPTION_MAX + " tegn.", 400, "VALIDATION_ERROR");
  }

  const tagsRaw = Array.isArray(o.tags) ? (o.tags as unknown[]).filter((t) => typeof t === "string") : [];
  const tags = (tagsRaw as string[])
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.slice(0, MEDIA_TAG_MAX_LEN));
  if (tags.length > MEDIA_TAGS_MAX_COUNT) {
    return jsonErr(ctx.rid, "Maks " + MEDIA_TAGS_MAX_COUNT + " tags.", 400, "VALIDATION_ERROR");
  }
  for (const t of tags) {
    if (t.length > MEDIA_TAG_MAX_LEN) {
      return jsonErr(ctx.rid, "Hver tag maks " + MEDIA_TAG_MAX_LEN + " tegn.", 400, "VALIDATION_ERROR");
    }
  }

  const width = typeof o.width === "number" && Number.isFinite(o.width) ? o.width : null;
  const height = typeof o.height === "number" && Number.isFinite(o.height) ? o.height : null;
  const mime_type = typeof o.mime_type === "string" ? o.mime_type.trim() || null : null;
  const metadata =
    o.metadata !== null && typeof o.metadata === "object"
      ? (o.metadata as Record<string, unknown>)
      : {};

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
        width: width ?? undefined,
        height: height ?? undefined,
        mime_type: mime_type ?? undefined,
        metadata,
        created_by: ctx.scope?.email ?? null,
      } as Record<string, unknown>)
      .select(mediaItemSelectColumns)
      .single();
    if (error) return jsonErr(ctx.rid, "Kunne ikke opprette medieelement.", 500, "MEDIA_CREATE_FAILED");
    const normalized = rowToMediaItem(inserted as Record<string, unknown>);
    if (!normalized) return jsonErr(ctx.rid, "Opprettelse fullfort men mangler url i respons.", 500, "MEDIA_CREATE_NO_URL");
    return jsonOk(ctx.rid, { item: normalized }, 200);
  } catch (e) {
    return jsonErr(ctx.rid, "Kunne ikke opprette medieelement.", 500, "MEDIA_CREATE_FAILED");
  }
}