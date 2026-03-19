/**
 * AI hero section designer capability: generateHeroLayout.
 * Suggests hero layout: structure (headline, subheadline, CTA, image placement), layout type, and content hints.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "generateHeroLayout";

const generateHeroLayoutCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Suggests hero section layout: layout type (centered, split, full-bleed, minimal), structure (headline, subheadline, CTA, image placement), and content hints (e.g. headline length). Uses conversion goal and optional image preference.",
  requiredContext: ["conversionGoal"],
  inputSchema: {
    type: "object",
    description: "Generate hero layout input",
    properties: {
      conversionGoal: {
        type: "string",
        description: "Primary conversion (e.g. signup, lead, purchase, book)",
      },
      hasImage: { type: "boolean", description: "Whether hero includes an image (default true)" },
      layoutPreference: {
        type: "string",
        description: "Optional: centered | split | full_bleed | minimal",
      },
      locale: { type: "string", description: "Locale (nb | en) for labels" },
    },
    required: ["conversionGoal"],
  },
  outputSchema: {
    type: "object",
    description: "Hero layout suggestion",
    required: ["recommended", "structure", "variants", "contentHints", "summary"],
    properties: {
      recommended: {
        type: "object",
        required: ["layoutType", "description"],
        properties: {
          layoutType: { type: "string", description: "centered | split | full_bleed | minimal" },
          description: { type: "string" },
          imagePosition: { type: "string", description: "right | left | background | none" },
        },
      },
      structure: {
        type: "array",
        items: {
          type: "object",
          required: ["element", "order", "required"],
          properties: {
            element: { type: "string", description: "headline | subheadline | cta | image" },
            order: { type: "number" },
            required: { type: "boolean" },
            placementHint: { type: "string" },
          },
        },
      },
      variants: {
        type: "array",
        items: {
          type: "object",
          properties: {
            layoutType: { type: "string" },
            description: { type: "string" },
            imagePosition: { type: "string" },
          },
        },
      },
      contentHints: {
        type: "object",
        properties: {
          headlineMaxWords: { type: "number" },
          subheadlineMaxWords: { type: "number" },
          ctaCount: { type: "number" },
        },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is layout suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateHeroLayoutCapability);

export type GenerateHeroLayoutInput = {
  conversionGoal: string;
  hasImage?: boolean | null;
  layoutPreference?: string | null;
  locale?: "nb" | "en" | null;
};

export type HeroLayoutRecommendation = {
  layoutType: "centered" | "split" | "full_bleed" | "minimal";
  description: string;
  imagePosition: "right" | "left" | "background" | "none";
};

export type HeroStructureElement = {
  element: "headline" | "subheadline" | "cta" | "image";
  order: number;
  required: boolean;
  placementHint?: string;
};

export type GenerateHeroLayoutOutput = {
  recommended: HeroLayoutRecommendation;
  structure: HeroStructureElement[];
  variants: HeroLayoutRecommendation[];
  contentHints: {
    headlineMaxWords: number;
    subheadlineMaxWords: number;
    ctaCount: number;
  };
  summary: string;
};

function pickLayout(
  hasImage: boolean,
  preference: string | null,
  isEn: boolean
): HeroLayoutRecommendation {
  const p = (preference ?? "").trim().toLowerCase();
  if (p === "minimal" || !hasImage) {
    return {
      layoutType: "minimal",
      description: isEn ? "Text-only hero: headline, short subheadline, one CTA. No image." : "Kun tekst: overskrift, kort underoverskrift, én CTA. Uten bilde.",
      imagePosition: "none",
    };
  }
  if (p === "full_bleed") {
    return {
      layoutType: "full_bleed",
      description: isEn ? "Full-width background image with overlay; text and CTA centered." : "Fullbredde bakgrunnsbilde med overlay; tekst og CTA sentrert.",
      imagePosition: "background",
    };
  }
  if (p === "split") {
    return {
      layoutType: "split",
      description: isEn ? "Two columns: copy left, image right (or vice versa)." : "To kolonner: tekst venstre, bilde høyre (eller omvendt).",
      imagePosition: "right",
    };
  }
  return {
    layoutType: "centered",
    description: isEn ? "Centered headline, subheadline, CTA; image below or as background." : "Sentrert overskrift, underoverskrift, CTA; bilde under eller som bakgrunn.",
    imagePosition: "background",
  };
}

function buildStructure(hasImage: boolean, layoutType: string): HeroStructureElement[] {
  const elements: HeroStructureElement[] = [
    { element: "headline", order: 1, required: true, placementHint: "One clear value proposition; above fold." },
    { element: "subheadline", order: 2, required: true, placementHint: "Short supporting line; 1–2 sentences." },
    { element: "cta", order: 3, required: true, placementHint: "Single primary CTA; optional secondary link." },
  ];
  if (hasImage) {
    elements.push({
      element: "image",
      order: layoutType === "split" ? 2 : 4,
      required: true,
      placementHint: layoutType === "split" ? "Opposite column to copy." : layoutType === "full_bleed" ? "Full-width background." : "Below or beside copy.",
    });
  }
  elements.sort((a, b) => a.order - b.order);
  return elements.map((e, i) => ({ ...e, order: i + 1 }));
}

/**
 * Generates hero layout suggestion: recommended layout type, structure, variants, and content hints.
 * Deterministic; no external calls.
 */
export function generateHeroLayout(input: GenerateHeroLayoutInput): GenerateHeroLayoutOutput {
  const isEn = input.locale === "en";
  const goal = (input.conversionGoal ?? "").trim();
  const hasImage = input.hasImage !== false;
  const preference = (input.layoutPreference ?? "").trim() || null;

  const recommended = pickLayout(hasImage, preference, isEn);
  const structure = buildStructure(hasImage, recommended.layoutType);

  const variants: HeroLayoutRecommendation[] = [];
  if (recommended.layoutType !== "centered") {
    variants.push(
      isEn
        ? { layoutType: "centered", description: "Centered copy; image below or background.", imagePosition: "background" }
        : { layoutType: "centered", description: "Sentrert tekst; bilde under eller bakgrunn.", imagePosition: "background" }
    );
  }
  if (recommended.layoutType !== "split" && hasImage) {
    variants.push(
      isEn
        ? { layoutType: "split", description: "Two columns: copy and image side by side.", imagePosition: "right" }
        : { layoutType: "split", description: "To kolonner: tekst og bilde side om side.", imagePosition: "right" }
    );
  }
  if (recommended.layoutType !== "minimal") {
    variants.push(
      isEn
        ? { layoutType: "minimal", description: "Text-only; no image.", imagePosition: "none" }
        : { layoutType: "minimal", description: "Kun tekst; uten bilde.", imagePosition: "none" }
    );
  }

  const contentHints = {
    headlineMaxWords: 8,
    subheadlineMaxWords: 20,
    ctaCount: 1,
  };

  const summary = isEn
    ? `Hero layout: ${recommended.layoutType}, image ${recommended.imagePosition}. Structure: ${structure.map((s) => s.element).join(" → ")}. One headline, one CTA.`
    : `Hero-oppsett: ${recommended.layoutType}, bilde ${recommended.imagePosition}. Struktur: ${structure.map((s) => s.element).join(" → ")}. Én overskrift, én CTA.`;

  return {
    recommended,
    structure,
    variants,
    contentHints,
    summary,
  };
}

export { generateHeroLayoutCapability, CAPABILITY_NAME };
