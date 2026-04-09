/**
 * AI scroll optimization engine capability: suggestScrollFlow.
 * Suggests section order, break points, and CTA placement to optimize scroll flow and engagement.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "suggestScrollFlow";

const suggestScrollFlowCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Suggests scroll flow optimizations: section order, where to add breaks or CTAs, and how to structure content for better scroll-through. Uses block/section list and optional per-section engagement signals.",
  requiredContext: ["sections"],
  inputSchema: {
    type: "object",
    description: "Suggest scroll flow input",
    properties: {
      sections: {
        type: "array",
        description: "Page sections/blocks in current order",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            type: { type: "string", description: "e.g. hero, richText, cta, faq, image" },
            heading: { type: "string" },
            wordCount: { type: "number", description: "Approximate word count for section" },
            position: { type: "number", description: "Current 0-based index" },
          },
        },
      },
      totalWordCount: { type: "number", description: "Optional total page word count" },
      scrollDepthAtSections: {
        type: "array",
        description: "Optional cumulative scroll depth after each section (0-1)",
        items: { type: "number" },
      },
      locale: { type: "string", description: "Locale (nb | en) for suggestions" },
    },
    required: ["sections"],
  },
  outputSchema: {
    type: "object",
    description: "Scroll flow suggestions",
    required: ["suggestions", "suggestedOrder", "summary"],
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "type", "message", "priority", "positionHint"],
          properties: {
            id: { type: "string" },
            type: { type: "string", description: "order | break | cta_placement | section_length" },
            message: { type: "string" },
            priority: { type: "string", description: "low | medium | high" },
            positionHint: { type: "number", description: "Section index to apply suggestion" },
            suggestedAction: { type: "string" },
          },
        },
      },
      suggestedOrder: {
        type: "array",
        description: "Recommended section order (indices or ids)",
        items: { type: "number" },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(suggestScrollFlowCapability);

export type ScrollFlowSectionInput = {
  id?: string | null;
  type?: string | null;
  heading?: string | null;
  wordCount?: number | null;
  position?: number | null;
};

export type SuggestScrollFlowInput = {
  sections: ScrollFlowSectionInput[];
  totalWordCount?: number | null;
  /** Optional cumulative scroll depth after each section (0-1). */
  scrollDepthAtSections?: number[] | null;
  locale?: "nb" | "en" | null;
};

export type ScrollFlowSuggestion = {
  id: string;
  type: "order" | "break" | "cta_placement" | "section_length";
  message: string;
  priority: "low" | "medium" | "high";
  positionHint: number;
  suggestedAction?: string;
};

export type SuggestScrollFlowOutput = {
  suggestions: ScrollFlowSuggestion[];
  suggestedOrder: number[];
  summary: string;
};

const SECTION_TYPE_WEIGHT: Record<string, number> = {
  hero: 0,
  richtext: 1,
  richText: 1,
  image: 1,
  cta: 2,
  faq: 3,
  accordion: 3,
  howTo: 2,
  steps: 2,
};

const MAX_WORDS_BEFORE_BREAK = 350;
const IDEAL_CTA_POSITION = 2;

function sectionTypeOrder(type: string): number {
  const t = (type ?? "").toLowerCase().trim();
  return SECTION_TYPE_WEIGHT[t] ?? 1;
}

/**
 * Suggests scroll flow: section order, breaks, CTA placement, and section length.
 * Deterministic; no external calls.
 */
export function suggestScrollFlow(input: SuggestScrollFlowInput): SuggestScrollFlowOutput {
  const isEn = input.locale === "en";
  const sections = Array.isArray(input.sections) ? input.sections : [];
  const totalWords = Math.max(0, Math.floor(Number(input.totalWordCount) ?? 0)) || sections.reduce((s, x) => s + Math.max(0, Math.floor(Number(x.wordCount) ?? 0)), 0);
  const scrollAt = Array.isArray(input.scrollDepthAtSections) ? input.scrollDepthAtSections : [];

  const suggestions: ScrollFlowSuggestion[] = [];
  const withIndex = sections.map((s, i) => ({
    ...s,
    position: typeof (s as ScrollFlowSectionInput).position === "number" ? (s as ScrollFlowSectionInput).position : i,
    wordCount: Math.max(0, Math.floor(Number((s as ScrollFlowSectionInput).wordCount) ?? 0)),
    type: ((s as ScrollFlowSectionInput).type ?? "richText").toString().toLowerCase(),
  }));

  const ctaIndex = withIndex.findIndex((s) => s.type === "cta");
  const hasCta = ctaIndex >= 0;
  const heroIndex = withIndex.findIndex((s) => s.type === "hero");

  if (!hasCta && withIndex.length >= 2) {
    suggestions.push({
      id: "scroll-flow-cta-add",
      type: "cta_placement",
      message: isEn
        ? "Add a primary CTA block early in the flow (e.g. after intro or second section)."
        : "Legg til en primær CTA-blokk tidlig i flyten (f.eks. etter intro eller andre seksjon).",
      priority: "high",
      positionHint: Math.min(IDEAL_CTA_POSITION, withIndex.length - 1),
      suggestedAction: isEn ? "Insert CTA after section 2." : "Sett inn CTA etter seksjon 2.",
    });
  } else if (hasCta && ctaIndex > 4) {
    suggestions.push({
      id: "scroll-flow-cta-move",
      type: "cta_placement",
      message: isEn
        ? "CTA is far down the page; consider moving it earlier to capture scroll-through."
        : "CTA ligger langt nede; vurder å flytte den tidligere for å fange rulling.",
      priority: "medium",
      positionHint: IDEAL_CTA_POSITION,
      suggestedAction: isEn ? "Move CTA to after section 2–3." : "Flytt CTA til etter seksjon 2–3.",
    });
  }

  for (let i = 0; i < withIndex.length; i++) {
    const s = withIndex[i];
    const wc = s.wordCount;
    if (wc > MAX_WORDS_BEFORE_BREAK && s.type === "richtext") {
      suggestions.push({
        id: `scroll-flow-length-${i}`,
        type: "section_length",
        message: isEn
          ? `Section ${i + 1} is long (${wc} words); consider splitting or adding a subheading/break.`
          : `Seksjon ${i + 1} er lang (${wc} ord); vurder å dele eller legge til underoverskrift/pause.`,
        priority: wc > 600 ? "high" : "medium",
        positionHint: i,
        suggestedAction: isEn ? "Split section or add visual break." : "Del seksjon eller legg til visuell pause.",
      });
    }
  }

  const longRun = withIndex.findIndex((s, i) => {
    const next = withIndex[i + 1];
    return next && s.type === "richtext" && next.type === "richtext" && (s.wordCount + (next.wordCount ?? 0)) > 500;
  });
  if (longRun >= 0) {
    suggestions.push({
      id: "scroll-flow-break",
      type: "break",
      message: isEn
        ? "Two long text sections in a row; add a break (image, CTA, or card) between them."
        : "To lange tekster på rad; legg inn en pause (bilde, CTA eller kort) mellom dem.",
      priority: "medium",
      positionHint: longRun + 1,
      suggestedAction: isEn ? "Insert break between sections." : "Sett inn pause mellom seksjoner.",
    });
  }

  const suggestedOrder = withIndex
    .map((_, i) => i)
    .sort((a, b) => {
      const typeA = sectionTypeOrder(withIndex[a].type);
      const typeB = sectionTypeOrder(withIndex[b].type);
      if (typeA !== typeB) return typeA - typeB;
      return a - b;
    });

  const orderChanged = suggestedOrder.some((v, i) => v !== withIndex[i].position);
  if (orderChanged && heroIndex === 0) {
    suggestions.push({
      id: "scroll-flow-order",
      type: "order",
      message: isEn
        ? "Recommended flow: hero first, then key content, then CTA, then FAQ/supporting."
        : "Anbefalt flyt: hero først, deretter nøkkelinnhold, deretter CTA, deretter FAQ/støtte.",
      priority: "low",
      positionHint: 0,
      suggestedAction: isEn ? "Keep hero first; order rest by type." : "Behold hero først; sorter resten på type.",
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: "scroll-flow-ok",
      type: "break",
      message: isEn ? "Scroll flow is within recommended range." : "Rulleflyt er innenfor anbefalt område.",
      priority: "low",
      positionHint: 0,
    });
  }

  const summary = isEn
    ? `${suggestions.length} scroll flow suggestion(s). ${orderChanged ? "Reordering suggested." : ""}`
    : `${suggestions.length} forslag til rulleflyt. ${orderChanged ? "Omrokkering anbefalt." : ""}`;

  return {
    suggestions,
    suggestedOrder: orderChanged ? suggestedOrder : withIndex.map((_, i) => i),
    summary,
  };
}

export { suggestScrollFlowCapability, CAPABILITY_NAME };
