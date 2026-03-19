/**
 * Safe AI orchestration layer for ContentWorkspace.
 * Request builders, response/error normalization, tool→feature mapping.
 * Tool IDs come from lib/ai/tools/registry (single source); editor state and apply remain here.
 */

import type { EditorAiFeature } from "@/domain/backoffice/ai/metrics/editorAiMetricsTypes";
import type { EditorToolId } from "@/lib/ai/tools/registry";
import {
  parseMetaToPageAiContract,
  contractToAiMetaShape,
} from "@/lib/cms/model/pageAiContractHelpers";
import type { Block, HeroSuggestion } from "./editorBlockTypes";

/** AI tool ids used for suggest route and metrics. Sourced from registry (suggest + editor-only). */
export type AiToolId = EditorToolId;

/** Map AI tool id to EditorAiFeature for error/metrics (observability). All editor-exposed tools have a mapping. */
export const AI_TOOL_TO_FEATURE: Partial<Record<string, EditorAiFeature>> = {
  "content.maintain.page": "improve_page",
  "seo.optimize.page": "seo_optimize",
  "landing.generate.sections": "generate_sections",
  "experiment.generate.variants": "structured_intent",
  "page.builder": "page_builder",
  "block.builder": "block_builder",
  "screenshot.builder": "screenshot_builder",
  "layout.suggestions": "layout_suggestions",
  "image.generate.brand_safe": "image_generate",
  "image.improve.metadata": "image_metadata",
};

/** Build AI suggest request blocks shape from editor blocks. */
export function buildAiBlocks(
  blocks: Block[]
): Array<{ id: Block["id"]; type: Block["type"]; data?: Record<string, unknown> }> {
  return blocks.map((b: Block) => {
    switch (b.type) {
      case "hero": {
        const { id, type, title, subtitle, imageUrl, imageAlt, ctaLabel, ctaHref } = b;
        return { id, type, data: { title, subtitle, imageUrl, imageAlt, ctaLabel, ctaHref } };
      }
      case "richText": {
        const { id, type, heading, body } = b;
        return { id, type, data: { heading, body } };
      }
      case "image": {
        const { id, type, assetPath, alt, caption } = b;
        return { id, type, data: { assetPath, alt, caption } };
      }
      case "cta": {
        const { id, type, title, body, buttonLabel, buttonHref } = b;
        return { id, type, data: { title, body, buttonLabel, buttonHref } };
      }
      case "banners": {
        const { id, type, items } = b;
        return { id, type, data: { items } };
      }
      case "divider": {
        const { id, type, style } = b;
        return { id, type, data: { style } };
      }
      case "code": {
        const { id, type, code, displayIntro, displayOutro } = b;
        return { id, type, data: { code, displayIntro, displayOutro } };
      }
      default: {
        const neverBlock: never = b;
        return { id: (neverBlock as Block).id, type: (neverBlock as Block).type };
      }
    }
  });
}

/** Build existing-blocks list for AI context (id + type only). */
export function buildAiExistingBlocks(blocks: Block[]): Array<{ id: string; type: string }> {
  return blocks.map((b) => ({ id: b.id, type: b.type }));
}

/** Build AI context meta from Page AI Contract (description, title for suggest route). */
export function buildAiMeta(meta: Record<string, unknown>): {
  description?: string;
  title?: string;
} {
  const contract = parseMetaToPageAiContract(meta);
  return contractToAiMetaShape(contract);
}

/** Rank hero media items by context tokens; return top 6 as HeroSuggestion[]. */
export function rankHeroMediaSuggestions(
  context: string,
  items: Array<{ id: string; url: string; filename?: string; alt?: string; createdAt?: string }>
): HeroSuggestion[] {
  const tokens = Array.from(
    new Set(
      context
        .toLowerCase()
        .split(/[^a-zæøå0-9]+/i)
        .filter((t) => t.length >= 3)
    )
  );
  if (!tokens.length) return [];
  const scored = items.map((item) => {
    const text = `${item.filename ?? ""} ${item.alt ?? ""}`.toLowerCase();
    let score = 0;
    const matched: string[] = [];
    for (const t of tokens) {
      if (text.includes(t)) {
        score += 1;
        matched.push(t);
      }
    }
    return { item, score, matched };
  });
  const filtered = scored.filter((s) => s.score > 0);
  if (!filtered.length) return [];
  filtered.sort((a, b) => b.score - a.score);
  const top = filtered.slice(0, 6);
  return top.map((entry) => {
    const filename = entry.item.filename;
    const basename = entry.item.url.split("/").pop() || "";
    const reasonTokens = entry.matched.slice(0, 3).join(", ");
    const reason = reasonTokens
      ? `Match på: ${reasonTokens}`
      : "Relevante nøkkelord funnet.";
    return {
      mediaId: entry.item.id,
      url: entry.item.url,
      alt: entry.item.alt,
      filename,
      basename,
      reason,
    };
  });
}

/**
 * Normalize AI API error message from status and JSON body.
 * Preserves 503 + FEATURE_DISABLED / "AI is disabled." → Norwegian message.
 */
export function normalizeAiApiError(status: number, json: unknown): string {
  const rawMsg =
    json &&
    typeof json === "object" &&
    "message" in (json as { message?: unknown }) &&
    typeof (json as { message?: unknown }).message === "string"
      ? (json as { message: string }).message
      : null;
  const code =
    json && typeof json === "object" && "error" in (json as { error?: unknown })
      ? (json as { error: string }).error
      : null;
  return status === 503 && (code === "FEATURE_DISABLED" || rawMsg === "AI is disabled.")
    ? "AI er ikke tilgjengelig (mangler serverkonfigurasjon)."
    : rawMsg || `Feil ${status}`;
}
