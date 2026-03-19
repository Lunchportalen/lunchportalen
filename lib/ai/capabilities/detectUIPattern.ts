/**
 * UI pattern detector capability: detectUIPattern.
 * Detects UI patterns from blocks or structure (hero, CTA strip, content sections, form, FAQ, etc.).
 * Returns detected patterns with id, name, description, confidence, and optional source block ids.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "detectUIPattern";

const detectUIPatternCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Detects UI patterns from blocks or structure description: hero banner, CTA strip, content sections, form, FAQ, image block, divider, etc. Returns pattern id, name, description, confidence (0-1), and optional source block ids. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Detect UI pattern input",
    properties: {
      blocks: {
        type: "array",
        description: "Blocks to analyze (id, type, data)",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            type: { type: "string" },
            data: { type: "object" },
          },
        },
      },
      structureDescription: {
        type: "string",
        description: "Optional text description of layout/structure to detect patterns from",
      },
      locale: { type: "string", description: "Locale (nb | en) for labels" },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "Detected UI patterns",
    required: ["patterns", "summary"],
    properties: {
      patterns: {
        type: "array",
        items: {
          type: "object",
          required: ["patternId", "name", "description", "confidence"],
          properties: {
            patternId: { type: "string", description: "e.g. hero_banner, cta_strip, content_sections" },
            name: { type: "string" },
            description: { type: "string" },
            confidence: { type: "number", description: "0-1" },
            category: { type: "string", description: "layout | conversion | content | form | navigation | decorative" },
            sourceBlockIds: { type: "array", items: { type: "string" } },
          },
        },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is detection only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(detectUIPatternCapability);

export type DetectUIPatternBlockInput = {
  id: string;
  type?: string | null;
  data?: Record<string, unknown> | null;
};

export type DetectUIPatternInput = {
  blocks?: DetectUIPatternBlockInput[] | null;
  structureDescription?: string | null;
  locale?: "nb" | "en" | null;
};

export type DetectedUIPattern = {
  patternId: string;
  name: string;
  description: string;
  confidence: number;
  category?: "layout" | "conversion" | "content" | "form" | "navigation" | "decorative";
  sourceBlockIds?: string[];
};

export type DetectUIPatternOutput = {
  patterns: DetectedUIPattern[];
  summary: string;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

type PatternDef = {
  patternId: string;
  nameEn: string;
  nameNb: string;
  descEn: string;
  descNb: string;
  category: DetectedUIPattern["category"];
  detectFromBlocks: (blocks: DetectUIPatternBlockInput[]) => { confidence: number; blockIds: string[] } | null;
  detectFromText: (text: string) => number;
};

const PATTERNS: PatternDef[] = [
  {
    patternId: "hero_banner",
    nameEn: "Hero banner",
    nameNb: "Hero-banner",
    descEn: "Above-the-fold headline section with optional CTA and image.",
    descNb: "Overskriftseksjon over fold med valgfri CTA og bilde.",
    category: "layout",
    detectFromBlocks: (blocks) => {
      const b = blocks.find((x) => (x.type ?? "").trim().toLowerCase() === "hero");
      return b ? { confidence: 1, blockIds: [b.id] } : null;
    },
    detectFromText: (t) => (/\bhero\b|banner|hovedseksjon|toppbilde|headline\s*section/i.test(t) ? 0.9 : 0),
  },
  {
    patternId: "cta_strip",
    nameEn: "CTA strip",
    nameNb: "CTA-stripe",
    descEn: "Conversion section with headline and primary action button.",
    descNb: "Konverteringsseksjon med overskrift og primær handlingsknapp.",
    category: "conversion",
    detectFromBlocks: (blocks) => {
      const cta = blocks.filter((x) => (x.type ?? "").trim().toLowerCase() === "cta");
      if (cta.length === 0) return null;
      return { confidence: cta.length === 1 ? 1 : 0.8, blockIds: cta.map((x) => x.id) };
    },
    detectFromText: (t) => (/\bcta\b|call\s*to\s*action|konvertering|knapp(?:e)?\s*seksjon/i.test(t) ? 0.9 : 0),
  },
  {
    patternId: "content_sections",
    nameEn: "Content sections",
    nameNb: "Innholdsseksjoner",
    descEn: "One or more text/content blocks (heading + body).",
    descNb: "Én eller flere tekst-/innholdsblokker (overskrift + brødtekst).",
    category: "content",
    detectFromBlocks: (blocks) => {
      const rich = blocks.filter((x) => (x.type ?? "").trim().toLowerCase() === "richtext");
      if (rich.length === 0) return null;
      const confidence = rich.length >= 2 ? 1 : 0.7;
      return { confidence, blockIds: rich.map((x) => x.id) };
    },
    detectFromText: (t) => (/\b(?:text|tekst|section|seksjon|content|innhold|paragraph)\b/i.test(t) ? 0.8 : 0),
  },
  {
    patternId: "form_block",
    nameEn: "Form block",
    nameNb: "Skjemablokk",
    descEn: "Embedded form (e.g. contact, demo request).",
    descNb: "Innbygd skjema (f.eks. kontakt, demo-forespørsel).",
    category: "form",
    detectFromBlocks: (blocks) => {
      const f = blocks.find((x) => (x.type ?? "").trim().toLowerCase() === "form");
      return f ? { confidence: 1, blockIds: [f.id] } : null;
    },
    detectFromText: (t) => (/\bform\b|skjema|contact\s*form|kontaktskjema/i.test(t) ? 0.9 : 0),
  },
  {
    patternId: "image_block",
    nameEn: "Image block",
    nameNb: "Bildeblokk",
    descEn: "Single image with optional caption.",
    descNb: "Enkelt bilde med valgfri bildetekst.",
    category: "content",
    detectFromBlocks: (blocks) => {
      const img = blocks.filter((x) => (x.type ?? "").trim().toLowerCase() === "image");
      if (img.length === 0) return null;
      return { confidence: img.length === 1 ? 1 : 0.9, blockIds: img.map((x) => x.id) };
    },
    detectFromText: (t) => (/\bimage\b|bilde(?:blokk)?|picture|photo/i.test(t) ? 0.8 : 0),
  },
  {
    patternId: "divider_separator",
    nameEn: "Divider / separator",
    nameNb: "Skillelinje / separator",
    descEn: "Visual separator between sections.",
    descNb: "Visuell skillelinje mellom seksjoner.",
    category: "decorative",
    detectFromBlocks: (blocks) => {
      const d = blocks.filter((x) => (x.type ?? "").trim().toLowerCase() === "divider");
      if (d.length === 0) return null;
      return { confidence: 1, blockIds: d.map((x) => x.id) };
    },
    detectFromText: (t) => (/\bdivider\b|skille(?:linje)?|separator/i.test(t) ? 0.9 : 0),
  },
  {
    patternId: "faq_section",
    nameEn: "FAQ section",
    nameNb: "FAQ-seksjon",
    descEn: "Frequently asked questions (accordion or list).",
    descNb: "Vanlige spørsmål (accordion eller liste).",
    category: "content",
    detectFromBlocks: (blocks) => {
      const faqCandidates = blocks.filter((x) => {
        const type = (x.type ?? "").trim().toLowerCase();
        if (type === "faq" || type === "accordion") return true;
        if (type !== "richtext") return false;
        const body = str((x.data as Record<string, unknown>)?.body);
        const heading = str((x.data as Record<string, unknown>)?.heading);
        const combined = (body + " " + heading).toLowerCase();
        return /faq|spørsmål\s*og\s*svar|ofte\s*stilte|q\s*&\s*a/i.test(combined);
      });
      if (faqCandidates.length === 0) return null;
      return { confidence: 0.85, blockIds: faqCandidates.map((x) => x.id) };
    },
    detectFromText: (t) => (/\bfaq\b|spørsmål\s*og\s*svar|accordion|ofte\s*stilte/i.test(t) ? 0.85 : 0),
  },
  {
    patternId: "value_props",
    nameEn: "Value propositions",
    nameNb: "Verdiargumenter",
    descEn: "Multiple value or benefit blocks (e.g. three columns).",
    descNb: "Flere verdi- eller fordelsblokker (f.eks. tre kolonner).",
    category: "content",
    detectFromBlocks: (blocks) => {
      const rich = blocks.filter((x) => (x.type ?? "").trim().toLowerCase() === "richtext");
      if (rich.length < 2) return null;
      const withValue = rich.filter((r) => {
        const body = str((r.data as Record<string, unknown>)?.body);
        const heading = str((r.data as Record<string, unknown>)?.heading);
        const c = (body + " " + heading).toLowerCase();
        return /fordel|benefit|verdi|value|hvorfor|why/i.test(c);
      });
      if (withValue.length < 2) return null;
      return { confidence: 0.8, blockIds: withValue.map((x) => x.id) };
    },
    detectFromText: (t) => (/\bvalue\s*prop|verdi(?:argument)?|fordeler|benefits|hvorfor/i.test(t) ? 0.8 : 0),
  },
];

/**
 * Detects UI patterns from blocks and/or structure description. Deterministic; no external calls.
 */
export function detectUIPattern(input: DetectUIPatternInput = {}): DetectUIPatternOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const blocks = Array.isArray(input.blocks)
    ? input.blocks.filter(
        (b): b is DetectUIPatternBlockInput =>
          b != null && typeof b === "object" && typeof (b as DetectUIPatternBlockInput).id === "string"
      )
    : [];
  const structureDescription = str(input.structureDescription);
  const hasBlocks = blocks.length > 0;
  const hasText = structureDescription.length > 0;

  const patterns: DetectedUIPattern[] = [];
  const seen = new Set<string>();

  for (const def of PATTERNS) {
    let confidence = 0;
    let sourceBlockIds: string[] = [];

    if (hasBlocks) {
      const fromBlocks = def.detectFromBlocks(blocks);
      if (fromBlocks) {
        confidence = Math.max(confidence, fromBlocks.confidence);
        sourceBlockIds = fromBlocks.blockIds;
      }
    }
    if (hasText) {
      const fromText = def.detectFromText(structureDescription);
      if (fromText > 0 && confidence < fromText) {
        confidence = fromText;
        if (sourceBlockIds.length === 0) sourceBlockIds = [];
      }
    }

    if (confidence >= 0.5 && !seen.has(def.patternId)) {
      seen.add(def.patternId);
      patterns.push({
        patternId: def.patternId,
        name: isEn ? def.nameEn : def.nameNb,
        description: isEn ? def.descEn : def.descNb,
        confidence,
        category: def.category,
        ...(sourceBlockIds.length > 0 ? { sourceBlockIds } : {}),
      });
    }
  }

  const summary = isEn
    ? `Detected ${patterns.length} UI pattern(s) from ${hasBlocks ? `${blocks.length} block(s)` : "structure description"}.`
    : `Detekterte ${patterns.length} UI-mønster(e) fra ${hasBlocks ? `${blocks.length} blokk(er)` : "strukturbeskrivelse"}.`;

  return {
    patterns,
    summary,
  };
}

export { detectUIPatternCapability, CAPABILITY_NAME };
