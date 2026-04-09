/**
 * Page-generation capability: generateFullPage.
 * Inputs: topic, audience, tone, structure preference.
 * Outputs: hero, intro, sections, CTA as block structure.
 * Import this module to register the capability (e.g. from suggest route or AI bootstrap).
 */

import type { BlockNode } from "@/lib/cms/model/blockTypes";
import { newBlockId } from "@/lib/cms/model/blockId";
import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "generateFullPage";

const generateFullPageCapability: Capability = {
  name: CAPABILITY_NAME,
  description: "Generates a full page structure: hero, intro, sections, and CTA blocks from topic, audience, tone, and structure preference.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Generate full page input",
    required: ["topic", "audience", "tone", "structurePreference"],
    properties: {
      topic: { type: "string", description: "Page topic or theme" },
      audience: { type: "string", description: "Target audience" },
      tone: { type: "string", description: "Tone of voice (e.g. enterprise, warm, neutral)" },
      structurePreference: { type: "string", description: "Structure preference (e.g. minimal, standard, detailed)" },
    },
  },
  outputSchema: {
    type: "object",
    description: "Generated page as block structure",
    required: ["hero", "intro", "sections", "cta"],
    properties: {
      hero: { type: "object", description: "Hero block" },
      intro: { type: "object", description: "Intro richText block" },
      sections: { type: "array", description: "Section blocks" },
      cta: { type: "object", description: "CTA block" },
    },
  },
  safetyConstraints: [
    { code: "no_user_content_injection", description: "Topic and audience are used for copy only; no raw HTML.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateFullPageCapability);

export type GenerateFullPageInput = {
  topic: string;
  audience: string;
  tone: string;
  structurePreference: string;
  /** Optional locale for copy (default nb). */
  locale?: "nb" | "en";
};

export type GenerateFullPageOutput = {
  hero: BlockNode;
  intro: BlockNode;
  sections: BlockNode[];
  cta: BlockNode;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Number of section blocks by structure preference. */
function sectionCount(pref: string): number {
  const p = pref.toLowerCase();
  if (p === "minimal") return 1;
  if (p === "detailed") return 4;
  return 2;
}

/**
 * Generates a full page as block structure: hero, intro, sections, CTA.
 * Deterministic from inputs; no LLM. Use for capability execution or as stub for future LLM wiring.
 */
export function generateFullPageBlocks(input: GenerateFullPageInput): GenerateFullPageOutput {
  const topic = safeStr(input.topic) || (input.locale === "en" ? "Overview" : "Oversikt");
  const audience = safeStr(input.audience) || (input.locale === "en" ? "Visitors" : "Besøkende");
  const tone = safeStr(input.tone).toLowerCase() || "neutral";
  const isEn = input.locale === "en";
  const n = sectionCount(input.structurePreference);

  const heroId = newBlockId();
  const hero: BlockNode = {
    id: heroId,
    type: "hero",
    data: {
      title: isEn ? `${topic} – for ${audience}` : `${topic} – for ${audience}`,
      subtitle:
        tone === "warm"
          ? isEn
            ? "Clear, friendly, and to the point."
            : "Tydelig, vennlig og saklig."
          : isEn
            ? "Structured and professional."
            : "Strukturert og profesjonell.",
      ctaLabel: isEn ? "Get in touch" : "Ta kontakt",
      ctaHref: "#kontakt",
      imageUrl: "",
      imageAlt: "",
    },
  };

  const introId = newBlockId();
  const intro: BlockNode = {
    id: introId,
    type: "richText",
    data: {
      heading: isEn ? "Introduction" : "Introduksjon",
      body: isEn
        ? `This page is about ${topic}, aimed at ${audience}. Edit the content to match your needs.`
        : `Denne siden handler om ${topic}, rettet mot ${audience}. Rediger innholdet etter behov.`,
    },
  };

  const sections: BlockNode[] = [];
  for (let i = 0; i < n; i++) {
    const id = newBlockId();
    const num = i + 1;
    sections.push({
      id,
      type: "richText",
      data: {
        heading: isEn ? `Section ${num}` : `Seksjon ${num}`,
        body: isEn ? `Content for section ${num}.` : `Innhold for seksjon ${num}.`,
      },
    });
  }

  const ctaId = newBlockId();
  const cta: BlockNode = {
    id: ctaId,
    type: "cta",
    data: {
      title: isEn ? "Ready to get started?" : "Klar for å komme i gang?",
      body: isEn ? "Contact us for more information." : "Kontakt oss for mer informasjon.",
      buttonLabel: isEn ? "Contact" : "Kontakt",
      buttonHref: "#kontakt",
    },
  };

  return { hero, intro, sections, cta };
}

/** Returns a flat array of blocks in page order: hero, intro, ...sections, cta. */
export function generateFullPageBlocksFlat(input: GenerateFullPageInput): BlockNode[] {
  const { hero, intro, sections, cta } = generateFullPageBlocks(input);
  return [hero, intro, ...sections, cta];
}

export { generateFullPageCapability, CAPABILITY_NAME };
