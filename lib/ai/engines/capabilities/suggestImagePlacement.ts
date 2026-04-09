/**
 * Image usage suggestions capability: suggestImagePlacement.
 * Input: page structure (blocks). Returns suggested placements for images.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "suggestImagePlacement";

export type PageStructureInput = {
  /** Blocks in order (id, type; data optional). */
  blocks: Array<{ id: string; type: string; data?: Record<string, unknown> }>;
};

export type ImagePlacementSuggestion = {
  /** Placement kind for deduplication. */
  kind: string;
  /** Human-readable label. */
  label: string;
  /** Where to place: "hero" | "after_hero" | "between_sections" | "before_cta" | "standalone". */
  placement: string;
  /** Suggested insert index (0-based) or null if N/A. */
  suggestedIndex: number | null;
  /** Short reason. */
  reason: string;
  /** Priority. */
  priority: "high" | "medium" | "low";
};

const suggestImagePlacementCapability: Capability = {
  name: CAPABILITY_NAME,
  description: "Suggests where to place images based on page structure (blocks). Returns placement kind, label, suggested index, and reason.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Page structure",
    required: ["blocks"],
    properties: {
      blocks: {
        type: "array",
        description: "Blocks in order [{ id, type, data? }]",
        items: {
          type: "object",
          properties: { id: { type: "string" }, type: { type: "string" }, data: { type: "object" } },
        },
      },
    },
  },
  outputSchema: {
    type: "object",
    description: "Image placement suggestions",
    required: ["suggestions"],
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kind: { type: "string" },
            label: { type: "string" },
            placement: { type: "string" },
            suggestedIndex: { type: "number" },
            reason: { type: "string" },
            priority: { type: "string" },
          },
        },
      },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is suggestions only; no content mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(suggestImagePlacementCapability);

export type SuggestImagePlacementInput = {
  pageStructure: PageStructureInput;
  locale?: "nb" | "en";
};

export type SuggestImagePlacementOutput = {
  suggestions: ImagePlacementSuggestion[];
};

const MAX_SUGGESTIONS = 6;

function normalizeBlocks(raw: unknown): Array<{ id: string; type: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 100)
    .filter((b): b is Record<string, unknown> => b != null && typeof b === "object" && !Array.isArray(b))
    .filter((b) => typeof b.id === "string" && typeof b.type === "string")
    .map((b) => ({ id: String(b.id), type: String(b.type).trim() }));
}

/**
 * Returns image placement suggestions from page structure.
 * Suggests hero image, image after hero, between sections, before CTA, etc.
 */
export function suggestImagePlacement(input: SuggestImagePlacementInput): SuggestImagePlacementOutput {
  const blocks = normalizeBlocks(input.pageStructure?.blocks ?? []);
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const suggestions: ImagePlacementSuggestion[] = [];

  const types = blocks.map((b) => b.type);
  const heroIndex = types.indexOf("hero");
  const ctaIndex = types.indexOf("cta");
  const richTextIndices = types.map((t, i) => (t === "richText" ? i : -1)).filter((i) => i >= 0);
  const imageCount = types.filter((t) => t === "image").length;

  if (heroIndex >= 0) {
    suggestions.push({
      kind: "hero_image",
      label: isEn ? "Use image in hero" : "Bruk bilde i hero",
      placement: "hero",
      suggestedIndex: heroIndex,
      reason: isEn ? "Hero images strengthen first impression." : "Hero-bilde styrker første inntrykk.",
      priority: "high",
    });
  }

  if (heroIndex >= 0 && blocks.length > heroIndex + 1) {
    suggestions.push({
      kind: "image_after_hero",
      label: isEn ? "Add image after hero" : "Legg til bilde etter hero",
      placement: "after_hero",
      suggestedIndex: heroIndex + 1,
      reason: isEn ? "Visual break after hero keeps attention." : "Visuell pause etter hero holder oppmerksomheten.",
      priority: "high",
    });
  }

  if (richTextIndices.length >= 2) {
    const mid = Math.floor(richTextIndices.length / 2);
    const insertAt = richTextIndices[mid] + 1;
    suggestions.push({
      kind: "image_between_sections",
      label: isEn ? "Add image between sections" : "Legg til bilde mellom seksjoner",
      placement: "between_sections",
      suggestedIndex: insertAt,
      reason: isEn ? "Image between text sections improves scannability." : "Bilde mellom tekstseksjoner forbedrer skanbarhet.",
      priority: "medium",
    });
  }

  if (ctaIndex >= 0) {
    suggestions.push({
      kind: "image_before_cta",
      label: isEn ? "Add image before CTA" : "Legg til bilde før CTA",
      placement: "before_cta",
      suggestedIndex: Math.max(0, ctaIndex - 1),
      reason: isEn ? "Image before CTA can support the call to action." : "Bilde før CTA kan støtte oppfordringen.",
      priority: "medium",
    });
  }

  if (imageCount === 0 && blocks.length > 0) {
    suggestions.push({
      kind: "first_image",
      label: isEn ? "Add first image to page" : "Legg til første bilde på siden",
      placement: "standalone",
      suggestedIndex: 1,
      reason: isEn ? "Pages with at least one image tend to perform better." : "Sider med minst ett bilde presterer ofte bedre.",
      priority: "high",
    });
  }

  return {
    suggestions: suggestions.slice(0, MAX_SUGGESTIONS),
  };
}

export { suggestImagePlacementCapability, CAPABILITY_NAME };
