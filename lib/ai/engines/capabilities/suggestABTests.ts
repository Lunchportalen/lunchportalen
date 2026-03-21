/**
 * AI experiment suggestions capability: suggestABTests.
 * Returns A/B test hypotheses based on page context (e.g. headline, CTA, intro).
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "suggestABTests";

const suggestABTestsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Suggests A/B test hypotheses for content and conversion. Returns hypothesis statements with suggested control/variant and metric to optimize.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Suggest A/B tests input",
    properties: {
      blocks: {
        type: "array",
        description: "Optional page blocks to tailor hypotheses (e.g. presence of CTA, hero)",
        items: { type: "object" },
      },
      locale: { type: "string", description: "Locale (nb | en) for hypothesis copy" },
    },
  },
  outputSchema: {
    type: "object",
    description: "A/B test hypotheses",
    required: ["hypotheses"],
    properties: {
      hypotheses: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "hypothesis", "suggestedControl", "suggestedVariant", "metric", "priority"],
          properties: {
            id: { type: "string" },
            hypothesis: { type: "string" },
            suggestedControl: { type: "string" },
            suggestedVariant: { type: "string" },
            metric: { type: "string" },
            priority: { type: "string", description: "low | medium | high" },
            targetElement: { type: "string", description: "Optional: headline | cta | intro | layout" },
          },
        },
      },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is hypotheses only; no content or experiment mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(suggestABTestsCapability);

export type BlockLike = { type: string; heading?: string; body?: string; title?: string; buttonLabel?: string };

export type SuggestABTestsInput = {
  /** Optional blocks to tailor which hypotheses are suggested. */
  blocks?: BlockLike[] | null;
  locale?: "nb" | "en" | null;
};

export type ABTestHypothesis = {
  id: string;
  hypothesis: string;
  suggestedControl: string;
  suggestedVariant: string;
  metric: string;
  priority: "low" | "medium" | "high";
  /** Optional: which element this hypothesis targets. */
  targetElement?: "headline" | "cta" | "intro" | "layout";
};

export type SuggestABTestsOutput = {
  hypotheses: ABTestHypothesis[];
};

function hasBlockType(blocks: BlockLike[], type: string): boolean {
  return Array.isArray(blocks) && blocks.some((b) => b.type === type);
}

function getFirstCtaLabel(blocks: BlockLike[]): string | null {
  if (!Array.isArray(blocks)) return null;
  const cta = blocks.find((b) => b.type === "cta");
  if (!cta) return null;
  const label = (cta as { buttonLabel?: string }).buttonLabel ?? (cta as { button_label?: string }).button_label;
  return typeof label === "string" && label.trim() ? label.trim() : null;
}

function getFirstHeadline(blocks: BlockLike[]): string | null {
  if (!Array.isArray(blocks)) return null;
  const hero = blocks.find((b) => b.type === "hero");
  if (hero) {
    const title = (hero.title ?? "").trim();
    if (title) return title;
  }
  const rich = blocks.find((b) => b.type === "richText");
  if (rich) {
    const heading = (rich.heading ?? "").trim();
    if (heading) return heading;
  }
  return null;
}

/**
 * Returns A/B test hypotheses. Uses blocks when provided to tailor suggestions (e.g. CTA label variants).
 * Deterministic; no external calls.
 */
export function suggestABTests(input: SuggestABTestsInput): SuggestABTestsOutput {
  const blocks = input.blocks ?? [];
  const isEn = input.locale === "en";
  const hypotheses: ABTestHypothesis[] = [];

  const ctaLabel = getFirstCtaLabel(blocks);
  const headline = getFirstHeadline(blocks);
  const hasCta = hasBlockType(blocks, "cta");
  const hasHero = hasBlockType(blocks, "hero");
  const hasRichText = hasBlockType(blocks, "richText");

  // Headline / title
  if (hasHero || hasRichText) {
    const control = headline && headline.length > 0 ? headline : (isEn ? "Current headline" : "Nåværende overskrift");
    hypotheses.push({
      id: "ab-headline",
      hypothesis: isEn
        ? "A shorter or benefit-focused headline will increase engagement or CTR."
        : "En kortere eller mer fordel-fokusert overskrift øker engasjement eller CTR.",
      suggestedControl: control,
      suggestedVariant: isEn ? "Shorter benefit-focused headline (e.g. 5–8 words)" : "Kortere fordel-fokusert overskrift (f.eks. 5–8 ord)",
      metric: "CTA clicks / conversions",
      priority: "high",
      targetElement: "headline",
    });
  }

  // CTA copy
  if (hasCta) {
    const control = ctaLabel ?? (isEn ? "Current button text" : "Nåværende knappetekst");
    hypotheses.push({
      id: "ab-cta-copy",
      hypothesis: isEn
        ? "A more action-oriented or specific CTA label will increase clicks."
        : "En mer handlingsorientert eller spesifikk knappetekst øker antall klikk.",
      suggestedControl: control,
      suggestedVariant: isEn ? "Try e.g. «Get offer» or «Book now»" : "Prøv f.eks. «Få tilbud» eller «Bestill nå»",
      metric: "CTA click-through rate",
      priority: "high",
      targetElement: "cta",
    });
    hypotheses.push({
      id: "ab-cta-length",
      hypothesis: isEn
        ? "A shorter CTA (1–2 words) may convert better than a longer phrase."
        : "En kortere CTA (1–2 ord) kan konvertere bedre enn en lengre setning.",
      suggestedControl: control,
      suggestedVariant: isEn ? "1–2 word CTA (e.g. «Contact», «Start»)" : "1–2 ord (f.eks. «Kontakt», «Start»)",
      metric: "CTA click-through rate",
      priority: "medium",
      targetElement: "cta",
    });
  }

  // Intro length
  if (hasRichText) {
    hypotheses.push({
      id: "ab-intro-length",
      hypothesis: isEn
        ? "A shorter first paragraph (1–2 sentences) may improve scroll and conversion."
        : "En kortere første avsnitt (1–2 setninger) kan forbedre scrolling og konvertering.",
      suggestedControl: isEn ? "Current intro length" : "Nåværende introlengde",
      suggestedVariant: isEn ? "Short intro (1–2 sentences, then expand below)" : "Kort intro (1–2 setninger, utdyp under)",
      metric: "Scroll depth / time on page / CTA clicks",
      priority: "medium",
      targetElement: "intro",
    });
  }

  // Generic layout / CTA placement
  hypotheses.push({
    id: "ab-cta-placement",
    hypothesis: isEn
      ? "Placing the primary CTA higher on the page will increase conversions."
      : "Å plassere hoved-CTA høyere på siden øker konverteringer.",
    suggestedControl: isEn ? "Current CTA position" : "Nåværende CTA-plassering",
    suggestedVariant: isEn ? "CTA above the fold or after first section" : "CTA over fold eller rett etter første seksjon",
    metric: "CTA clicks / conversions",
    priority: "high",
    targetElement: "layout",
  });

  // Trust / social proof
  hypotheses.push({
    id: "ab-trust-signal",
    hypothesis: isEn
      ? "Adding a short trust signal (e.g. «Used by X companies») near the CTA increases conversions."
      : "Å legge til et kort tillitssignal (f.eks. «Brukes av X bedrifter») nær CTA øker konverteringer.",
    suggestedControl: isEn ? "No trust line" : "Ingen tillitslinje",
    suggestedVariant: isEn ? "Short trust line near CTA" : "Kort tillitslinje nær CTA",
    metric: "CTA click-through rate / conversions",
    priority: "low",
    targetElement: "layout",
  });

  return {
    hypotheses,
  };
}

export { suggestABTestsCapability, CAPABILITY_NAME };
