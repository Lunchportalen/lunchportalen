/**
 * Media file upload API.
 * - Accepts multipart/form-data with a single "file" field (image/*).
 * - Uploads to Supabase Storage bucket and registers media_items row (type=image, source=upload, status=ready).
 * - Authorization: superadmin only (same as /api/backoffice/media/items).
 */
import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { supabaseAdmin, hasSupabaseAdminConfig } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function serializeError(e: unknown): string {
  if (e == null) return "Unknown error";
  if (e instanceof Error) return e.message || e.name || "Error";
  try {
    const s = JSON.stringify(e);
    return s.length > 500 ? s.slice(0, 500) + "…" : s;
  } catch {
    return String(e);
  }
}

function getMediaBucket(): string {
  const fromEnv = process.env.MEDIA_STORAGE_BUCKET;
  if (fromEnv && typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.trim();
  }
  // Default bucket name; must exist in Supabase Storage.
  return "media";
}

function sanitizeFileName(name: string | null | undefined): string {
  const fallback = "upload";
  if (!name || typeof name !== "string") return fallback;
  const trimmed = name.trim();
  if (!trimmed) return fallback;
  // Basic sanitization: strip path segments and unsafe chars.
  const base = trimmed.split(/[\\/]/).pop() || fallback;
  return base.replace(/[^a-zA-Z0-9._-]/g, "_") || fallback;
}

export async function POST(request: NextRequest) {
  const { scopeOr401, requireRoleOr403, denyResponse } = await import("@/lib/http/routeGuard");

  const s = await scopeOr401(request);
  if (s.ok === false) return denyResponse(s);
  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, ["superadmin"]);
  if (deny) return deny;

  if (!hasSupabaseAdminConfig()) {
    return jsonErr(ctx.rid, "Supabase admin-konfigurasjon mangler.", 500, "MEDIA_UPLOAD_CONFIG_MISSING");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonErr(ctx.rid, "Ugyldig multipart-formdata.", 400, "BAD_REQUEST");
  }

  const file = form.get("file");
  if (!file || !(file instanceof Blob)) {
    return jsonErr(ctx.rid, "Mangler filfelt 'file'.", 400, "BAD_REQUEST");
  }

  const fileSize = file.size;
  const contentType = (file as File).type || "application/octet-stream";

  // Basic guard: only allow images up to 10MB in this initial implementation.
  const MAX_BYTES = 10 * 1024 * 1024;
  if (!contentType.startsWith("image/")) {
    return jsonErr(ctx.rid, "Kun bildefiler er tillatt.", 400, "MEDIA_UPLOAD_INVALID_TYPE");
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_BYTES) {
    return jsonErr(
      ctx.rid,
      "Filstørrelse må være > 0 og maks 10 MB.",
      400,
      "MEDIA_UPLOAD_INVALID_SIZE"
    );
  }

  const originalName = (file as File).name ?? null;
  const safeName = sanitizeFileName(originalName);
  const ext = safeName.includes(".") ? safeName.slice(safeName.lastIndexOf(".") + 1).toLowerCase() : "";
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const ts = now.getTime();
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? (crypto.randomUUID as () => string)() : `${ts}`;
  const fileName = ext ? `${rand}.${ext}` : rand;
  const objectPath = `uploads/${y}/${m}/${d}/${fileName}`;

  const bucket = getMediaBucket();

  try {
    const admin = supabaseAdmin();

    // 1) Upload binary to storage bucket.
    const { error: uploadError } = await admin.storage.from(bucket).upload(objectPath, file, {
      cacheControl: "3600",
      contentType,
      upsert: false,
    });
    if (uploadError) {
      return jsonErr(
        ctx.rid,
        "Kunne ikke laste opp fil til lagring.",
        500,
        "MEDIA_UPLOAD_FAILED",
        { detail: serializeError(uploadError) }
      );
    }

    // 2) Derive public URL (bucket should be configured as public or behind CDN).
    const { data: urlData } = admin.storage.from(bucket).getPublicUrl(objectPath);
    const publicUrl = urlData?.publicUrl;
    if (!publicUrl) {
      return jsonErr(
        ctx.rid,
        "Kunne ikke generere offentlig URL for fil.",
        500,
        "MEDIA_UPLOAD_URL_FAILED"
      );
    }

    // 3) Persist media_items row using existing model (type=image, source=upload).
    const altRaw = typeof form.get("alt") === "string" ? String(form.get("alt")).trim() : "";
    const captionRaw = typeof form.get("caption") === "string" ? String(form.get("caption")).trim() : "";
    const tagsRaw = form.getAll("tags").filter((t) => typeof t === "string") as string[];
    const tags: string[] = tagsRaw
      .flatMap((t) => t.split(","))
      .map((t) => t.trim())
      .filter(Boolean);

    // Use the same validations as POST /media/items by delegating to that route's logic when possible
    // but keep this endpoint self-contained to avoid circular imports.
    const { validateMediaUrl, MEDIA_ALT_MAX, MEDIA_CAPTION_MAX, MEDIA_TAGS_MAX_COUNT, MEDIA_TAG_MAX_LEN } =
      await import("@/lib/media/validation");

    const urlCheck = validateMediaUrl(publicUrl);
    if (!urlCheck.ok) {
      return jsonErr(ctx.rid, urlCheck.message, 400, urlCheck.code);
    }

    const alt =
      altRaw.length > MEDIA_ALT_MAX ? altRaw.slice(0, MEDIA_ALT_MAX).trimEnd() : altRaw;
    const caption =
      captionRaw.length === 0
        ? null
        : captionRaw.length > MEDIA_CAPTION_MAX
        ? captionRaw.slice(0, MEDIA_CAPTION_MAX).trimEnd()
        : captionRaw;

    if (tags.length > MEDIA_TAGS_MAX_COUNT) {
      return jsonErr(
        ctx.rid,
        "Maks " + MEDIA_TAGS_MAX_COUNT + " tags.",
        400,
        "VALIDATION_ERROR"
      );
    }
    const finalTags = tags.map((t) =>
      t.length > MEDIA_TAG_MAX_LEN ? t.slice(0, MEDIA_TAG_MAX_LEN).trimEnd() : t
    );

    const { data: inserted, error: insertError } = await admin
      .from("media_items")
      .insert({
        type: "image",
        status: "ready",
        source: "upload",
        url: publicUrl,
        alt,
        caption,
        tags: finalTags,
        width: null,
        height: null,
        mime_type: contentType,
        bytes: fileSize,
        metadata: { storageBucket: bucket, path: objectPath, originalName: originalName ?? null },
        created_by: ctx.scope?.email ?? null,
      } as Record<string, unknown>)
      .select("*")
      .single();

    if (insertError || !inserted) {
      return jsonErr(
        ctx.rid,
        "Kunne ikke opprette medieelement.",
        500,
        "MEDIA_CREATE_FAILED",
        { detail: serializeError(insertError) }
      );
    }

    const { rowToMediaItem } = await import("@/lib/media/normalize");
    const normalized = rowToMediaItem(inserted as Record<string, unknown>);
    if (!normalized) {
      return jsonErr(
        ctx.rid,
        "Opprettelse fullført men mangler url i respons.",
        500,
        "MEDIA_CREATE_NO_URL"
      );
    }

    return jsonOk(ctx.rid, { item: normalized }, 200);
  } catch (e) {
    return jsonErr(
      ctx.rid,
      "Uventet feil ved opplasting av media.",
      500,
      "MEDIA_UPLOAD_FAILED",
      { detail: serializeError(e) }
    );
  }
}

