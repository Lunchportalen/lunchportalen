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
import { getBlockEntryFlatForRender, isBlockWithEntryModel } from "@/lib/cms/blocks/blockEntryContract";
import { getBlockTreeLabel } from "./blockLabels";
import { makeBlockId, normalizeBlock } from "./contentWorkspace.blocks";
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
    if (isBlockWithEntryModel(b)) {
      return { id: b.id, type: b.type, data: getBlockEntryFlatForRender(b) };
    }
    switch (b.type) {
      case "richText": {
        const { id, type, heading, body } = b;
        return { id, type, data: { heading, body } };
      }
      case "image": {
        const { id, type, imageId, alt, caption } = b;
        return { id, type, data: { imageId, alt, caption } };
      }
      case "divider": {
        const { id, type, style } = b;
        return { id, type, data: { style } };
      }
      case "banner": {
        const { id, type, text, ctaLabel, ctaHref, backgroundImageId, backgroundMediaItemId, variant } = b;
        return {
          id,
          type,
          data: {
            text,
            ctaLabel,
            ctaHref,
            backgroundImageId,
            backgroundMediaItemId,
            variant,
          },
        };
      }
      case "form": {
        const { id, type, formId, title } = b;
        return { id, type, data: { formId, title } };
      }
      default: {
        const _x: never = b;
        void _x;
        return { id: "", type: "richText", data: {} };
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

/** Summarize block list for AI prompts (full-page draft, etc.). */
export function summarizeBlocksForAiPrompt(list: Block[]): string {
  if (!list.length) return "";
  return list
    .map((b, i) => `${i + 1}. ${getBlockTreeLabel(b)}`)
    .join("\n")
    .slice(0, 4000);
}

/** Maps `/api/ai/layout` & `/api/ai/page` block JSON to editor blocks (preview insert only). */
export function mapSerializedAiBlockToBlock(raw: unknown): Block | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const type = typeof o.type === "string" ? o.type : "";
  if (!type) return null;
  const id = typeof o.id === "string" && o.id.length > 0 ? o.id : makeBlockId();
  return normalizeBlock({ id, type, ...o });
}
