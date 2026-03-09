import type { NextRequest } from "next/server";
import { isAIEnabled } from "@/lib/ai/provider";
import { imageImproveMetadataToSuggestion } from "@/lib/ai/tools/imageImproveMetadata";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TAGS_MAX = 8;

function normalizeMetadata(suggestion: { alt?: string; caption?: string | null; tags?: string[] } | undefined): {
  alt: string;
  caption: string | null;
  tags: string[];
} {
  const alt = typeof suggestion?.alt === "string" ? suggestion.alt.trim().slice(0, 180) : "";
  const captionRaw = suggestion?.caption;
  const caption =
    captionRaw == null || typeof captionRaw !== "string"
      ? null
      : captionRaw.trim().slice(0, 500) || null;
  const rawTags = Array.isArray(suggestion?.tags) ? suggestion.tags : [];
  const tags = [...new Set(rawTags.map((t) => (typeof t === "string" ? t.trim() : "").slice(0, 30)).filter(Boolean))].slice(0, TAGS_MAX);
  return { alt, caption, tags };
}

export async function POST(req: NextRequest) {
  const rid = makeRid();
  const gate = await scopeOr401(req);
  if (gate.ok === false) return gate.res;
  const deny = requireRoleOr403(gate.ctx, ["superadmin", "company_admin"]);
  if (deny) return deny;
  if (!isAIEnabled()) return jsonErr(rid, "AI is disabled.", 503, "FEATURE_DISABLED");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonErr(rid, "Invalid JSON.", 400, "BAD_REQUEST");
  }
  const o = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  if (!o) return jsonErr(rid, "Body must be an object.", 400, "BAD_REQUEST");

  const url = typeof o.url === "string" ? o.url.trim() : "";
  const mediaItemId = typeof o.mediaItemId === "string" ? o.mediaItemId.trim() : "";
  if (!url && !mediaItemId) {
    return jsonErr(rid, "Missing both url and mediaItemId; at least one required.", 400, "MISSING_INPUT");
  }

  const locale = o.locale === "en" ? "en" : "nb";
  const pageTitle = typeof o.pageTitle === "string" ? o.pageTitle.trim() : undefined;
  const contextRaw = o.context && typeof o.context === "object" && !Array.isArray(o.context) ? (o.context as Record<string, unknown>) : undefined;
  const topic = contextRaw && typeof contextRaw.topic === "string" ? contextRaw.topic.trim() : pageTitle;
  const purpose = (contextRaw?.purpose === "section" || contextRaw?.purpose === "social" ? contextRaw.purpose : "hero") as "hero" | "section" | "social";

  const improveInput = {
    locale,
    mediaItemId: mediaItemId || "unknown",
    url: url || "",
    current: { alt: "", caption: null as string | null, tags: [] as string[] },
    context: pageTitle || topic || purpose ? { pageTitle, topic, purpose } : undefined,
    mode: "safe" as const,
  };
  const out = imageImproveMetadataToSuggestion(improveInput);
  const { alt, caption, tags } = normalizeMetadata(out.suggestion);
  const message = out.summary;

  return jsonOk(rid, {
    alt,
    caption,
    tags,
    mediaItemId: mediaItemId || "(none)",
    url: url || "(none)",
    message,
  }, 200);
}
