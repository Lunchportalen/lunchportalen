/**
 * POST /api/backoffice/ai/image-metadata
 * Request: { mediaItemId?, url?, locale?, pageTitle?, context? { topic?, purpose? }, current? { alt?, caption?, tags? } }
 * At least one of mediaItemId or url required. Optional current = existing media metadata so suggestions only fill gaps.
 * Response: normalized { alt, caption, tags } safe to apply (clamped); empty alt when no suggestion.
 */
import type { NextRequest } from "next/server";
import { isAIEnabled } from "@/lib/ai/runner";
import { imageImproveMetadataToSuggestion } from "@/lib/ai/tools/imageImproveMetadata";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { prepareAiResponseForClient } from "@/lib/ai/responseSafety";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALT_MAX = 180;
const CAPTION_MAX = 500;
const TAGS_MAX = 8;
const TAG_MAX_LEN = 30;

function normalizeMetadata(suggestion: { alt?: string; caption?: string | null; tags?: string[] } | undefined): {
  alt: string;
  caption: string | null;
  tags: string[];
} {
  const alt = typeof suggestion?.alt === "string" ? suggestion.alt.trim().slice(0, ALT_MAX) : "";
  const captionRaw = suggestion?.caption;
  const caption =
    captionRaw == null || typeof captionRaw !== "string"
      ? null
      : captionRaw.trim().slice(0, CAPTION_MAX) || null;
  const rawTags = Array.isArray(suggestion?.tags) ? suggestion.tags : [];
  const tags = [...new Set(rawTags.map((t) => (typeof t === "string" ? t.trim() : "").slice(0, TAG_MAX_LEN)).filter(Boolean))].slice(0, TAGS_MAX);
  return { alt, caption, tags };
}

function normalizeCurrentFromBody(o: Record<string, unknown>): { alt: string; caption: string | null; tags: string[] } {
  const currentRaw = o.current && typeof o.current === "object" && !Array.isArray(o.current) ? (o.current as Record<string, unknown>) : undefined;
  if (!currentRaw) return { alt: "", caption: null, tags: [] };
  const alt = typeof currentRaw.alt === "string" ? currentRaw.alt.trim().slice(0, ALT_MAX) : "";
  const captionRaw = currentRaw.caption;
  const caption = captionRaw === null ? null : typeof captionRaw === "string" ? captionRaw.trim().slice(0, CAPTION_MAX) || null : null;
  const tags = Array.isArray(currentRaw.tags)
    ? (currentRaw.tags as unknown[]).map((t) => (typeof t === "string" ? t.trim().slice(0, TAG_MAX_LEN) : "")).filter(Boolean).slice(0, 20)
    : [];
  return { alt, caption, tags };
}

export async function POST(req: NextRequest) {
  return withApiAiEntrypoint(req, "POST", async () => {
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;
  const ctx = gate.ctx;
  if (!isAIEnabled()) return jsonErr(ctx.rid, "AI is disabled.", 503, "FEATURE_DISABLED");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(ctx.rid, "Invalid JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(ctx.rid, "Body must be an object.", 400, "BAD_REQUEST");

  const url = typeof o.url === "string" ? o.url.trim() : "";
  const mediaItemId = typeof o.mediaItemId === "string" ? o.mediaItemId.trim() : "";
  if (!url && !mediaItemId) {
    return jsonErr(ctx.rid, "Missing both url and mediaItemId; at least one required.", 400, "MISSING_INPUT");
  }

  const locale = o.locale === "en" ? "en" : "nb";
  const pageTitle = typeof o.pageTitle === "string" ? o.pageTitle.trim() : undefined;
  const contextRaw = o.context && typeof o.context === "object" && !Array.isArray(o.context) ? (o.context as Record<string, unknown>) : undefined;
  const topic = contextRaw && typeof contextRaw.topic === "string" ? contextRaw.topic.trim() : pageTitle;
  const purpose = (contextRaw?.purpose === "section" || contextRaw?.purpose === "social" ? contextRaw.purpose : "hero") as "hero" | "section" | "social";

  const current = normalizeCurrentFromBody(o);
  const improveInput = {
    locale,
    mediaItemId: mediaItemId || "unknown",
    url: url || "",
    current,
    context: pageTitle || topic || purpose ? { pageTitle, topic, purpose } : undefined,
    mode: "safe" as const,
  };
  const out = imageImproveMetadataToSuggestion(improveInput);
  const { alt, caption, tags } = normalizeMetadata(out.suggestion);
  const message = out.summary;

  const responsePayload = {
    alt,
    caption,
    tags,
    mediaItemId: mediaItemId || "(none)",
    url: url || "(none)",
    message,
  };
  const prepared = prepareAiResponseForClient(responsePayload);
  if (!prepared.ok) {
    return jsonErr(ctx.rid, prepared.message ?? "AI response contained unsafe content.", 400, "AI_SAFETY_REJECTED");
  }
  try {
    const { error } = await supabaseAdmin().from("ai_activity_log").insert(
      buildAiActivityLogRow({
        action: "image_metadata",
        page_id: null,
        variant_id: null,
        actor_user_id: ctx.scope?.email ?? null,
        tool: "image_metadata",
        environment: "preview",
        locale,
        metadata: { mediaItemId: mediaItemId || undefined },
      })
    );
    if (error) {
      const { opsLog } = await import("@/lib/ops/log");
      opsLog("ai_activity_log.insert_failed", { route: "image-metadata", action: "image_metadata", error: error.message });
    }
  } catch {
    // Best-effort: do not mask response
  }
  return jsonOk(ctx.rid, prepared.data, 200);
  });
}
