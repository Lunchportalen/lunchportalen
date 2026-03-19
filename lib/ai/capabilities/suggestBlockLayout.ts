/**
 * Block layout AI capability: suggestBlockLayout.
 * Suggests block order and structure for a page: recommended sequence (block ids),
 * layout suggestions (e.g. hero first, CTA near end, break long runs), and summary.
 * Deterministic; no LLM. Aligns with 1-3-1 and conversion flow.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "suggestBlockLayout";

const suggestBlockLayoutCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Suggests block layout: recommended block order (sequence of block ids), layout suggestions (hero first, CTA placement, break long runs), and rationale. Uses current blocks and optional page purpose. Deterministic; no LLM.",
  requiredContext: ["blocks"],
  inputSchema: {
    type: "object",
    description: "Suggest block layout input",
    properties: {
      blocks: {
        type: "array",
        description: "Current blocks (id, type, optional data)",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            type: { type: "string", description: "hero, richText, cta, image, divider, form" },
            data: { type: "object" },
          },
        },
      },
      pagePurpose: { type: "string", description: "Optional: landing, product, form, info" },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["blocks"],
  },
  outputSchema: {
    type: "object",
    description: "Block layout suggestion",
    required: ["suggestedOrder", "suggestions", "summary"],
    properties: {
      suggestedOrder: {
        type: "array",
        description: "Recommended block ids in display order",
        items: { type: "string" },
      },
      suggestions: {
        type: "array",
        description: "Layout improvement suggestions",
        items: {
          type: "object",
          required: ["kind", "message", "priority"],
          properties: {
            kind: { type: "string", description: "hero_first | cta_placement | break_run | add_divider | reorder" },
            message: { type: "string" },
            priority: { type: "string", description: "high | medium | low" },
            blockId: { type: "string", description: "Relevant block id if any" },
            indexHint: { type: "number", description: "Suggested index for reorder/insert" },
          },
        },
      },
      summary: { type: "string", description: "Short rationale" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is layout suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(suggestBlockLayoutCapability);

export type BlockLayoutBlockInput = {
  id: string;
  type?: string | null;
  data?: Record<string, unknown> | null;
};

export type SuggestBlockLayoutInput = {
  blocks: BlockLayoutBlockInput[];
  pagePurpose?: string | null;
  locale?: "nb" | "en" | null;
};

export type BlockLayoutSuggestion = {
  kind: "hero_first" | "cta_placement" | "break_run" | "add_divider" | "reorder";
  message: string;
  priority: "high" | "medium" | "low";
  blockId?: string | null;
  indexHint?: number | null;
};

export type SuggestBlockLayoutOutput = {
  suggestedOrder: string[];
  suggestions: BlockLayoutSuggestion[];
  summary: string;
};

/**
 * Suggests block layout: order and improvements. Deterministic; no external calls.
 */
export function suggestBlockLayout(input: SuggestBlockLayoutInput): SuggestBlockLayoutOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const blocks = Array.isArray(input.blocks)
    ? input.blocks.filter(
        (b): b is BlockLayoutBlockInput => b != null && typeof b === "object" && typeof (b as BlockLayoutBlockInput).id === "string"
      )
    : [];

  const suggestions: BlockLayoutSuggestion[] = [];
  const seen = new Set<string>();

  function add(
    kind: BlockLayoutSuggestion["kind"],
    message: string,
    priority: BlockLayoutSuggestion["priority"],
    opts?: { blockId?: string | null; indexHint?: number | null }
  ) {
    const key = `${kind}:${opts?.blockId ?? ""}:${opts?.indexHint ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    suggestions.push({
      kind,
      message,
      priority,
      blockId: opts?.blockId ?? undefined,
      indexHint: opts?.indexHint ?? undefined,
    });
  }

  if (blocks.length === 0) {
    return {
      suggestedOrder: [],
      suggestions: [
        {
          kind: "hero_first",
          message: isEn
            ? "Add a hero block first for a clear first impression."
            : "Legg til en hero-blokk først for tydelig første inntrykk.",
          priority: "high",
        },
      ],
      summary: isEn ? "No blocks; add a hero then content and CTA." : "Ingen blokker; legg til hero, deretter innhold og CTA.",
    };
  }

  const types = blocks.map((b) => (b.type ?? "").trim().toLowerCase());
  const firstType = types[0];
  const hasHero = types.includes("hero");
  const hasCta = types.includes("cta");
  const heroIndex = types.indexOf("hero");
  const ctaIndex = types.indexOf("cta");
  const lastIndex = blocks.length - 1;

  if (hasHero && heroIndex !== 0) {
    add(
      "hero_first",
      isEn
        ? "Hero works best at the top; consider moving it to position 0."
        : "Hero fungerer best øverst; vurder å flytte den til posisjon 0.",
      "high",
      { blockId: blocks[heroIndex]?.id, indexHint: 0 }
    );
  }

  if (!hasHero) {
    add(
      "hero_first",
      isEn
        ? "Consider adding a hero block at the top for a clear headline and CTA."
        : "Vurder å legge til en hero-blokk øverst for tydelig overskrift og CTA.",
      "high",
      { indexHint: 0 }
    );
  }

  if (hasCta && ctaIndex < lastIndex - 1) {
    add(
      "cta_placement",
      isEn
        ? "CTA is often most effective near the end; consider moving it later."
        : "CTA er ofte mest effektiv nær slutten; vurder å flytte den lenger ned.",
      "medium",
      { blockId: blocks[ctaIndex]?.id, indexHint: lastIndex }
    );
  }

  if (!hasCta && blocks.length >= 2) {
    add(
      "cta_placement",
      isEn
        ? "Consider adding a CTA block before the end to guide the user to action."
        : "Vurder å legge til en CTA-blokk før slutten for å lede brukeren til handling.",
      "medium",
      { indexHint: lastIndex }
    );
  }

  let richTextRun = 0;
  for (let i = 0; i < types.length; i++) {
    if (types[i] === "richtext") richTextRun += 1;
    else richTextRun = 0;
    if (richTextRun >= 3) {
      add(
        "break_run",
        isEn
          ? "Several text blocks in a row; consider inserting an image or divider to improve scannability."
          : "Flere tekstblokker på rad; vurder å sette inn bilde eller skillelinje for bedre skanbarhet.",
        "low",
        { blockId: blocks[i]?.id, indexHint: i }
      );
      break;
    }
  }

  const hasDivider = types.includes("divider");
  if (blocks.length >= 4 && !hasDivider && (hasHero && hasCta)) {
    const between = Math.floor(blocks.length / 2);
    add(
      "add_divider",
      isEn
        ? "A divider between content and CTA can improve visual hierarchy."
        : "En skillelinje mellom innhold og CTA kan forbedre visuelt hierarki.",
      "low",
      { indexHint: between }
    );
  }

  const ids = blocks.map((b) => b.id);

  const suggestedOrder =
    heroIndex >= 0 && firstType !== "hero"
      ? (() => {
          const heroId = blocks[heroIndex]!.id;
          const rest = ids.filter((id) => id !== heroId);
          return [heroId, ...rest];
        })()
      : ids;

  const summary = isEn
    ? `Suggested order: ${suggestedOrder.length} block(s). ${suggestions.length} layout suggestion(s).`
    : `Forslått rekkefølge: ${suggestedOrder.length} blokk(er). ${suggestions.length} layoutforslag.`;

  return {
    suggestedOrder,
    suggestions,
    summary,
  };
}

export { suggestBlockLayoutCapability, CAPABILITY_NAME };
