/**
 * Block-generation capability: generateBlock.
 * Inputs: block type, context, tone.
 * Outputs: block JSON compatible with renderBlock (id, type, data).
 * Import this module to register the capability.
 */

import type { BlockNode } from "@/lib/cms/model/blockTypes";
import { newBlockId } from "@/lib/cms/model/blockId";
import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "generateBlock";

/** Block types that produce output compatible with renderBlock (hero, richText, cta, image, divider, form). */
export const GENERATE_BLOCK_TYPES = ["hero", "richText", "cta", "image", "divider", "form"] as const;
export type GenerateBlockType = (typeof GENERATE_BLOCK_TYPES)[number];

function isGenerateBlockType(s: string): s is GenerateBlockType {
  return (GENERATE_BLOCK_TYPES as readonly string[]).includes(s);
}

const generateBlockCapability: Capability = {
  name: CAPABILITY_NAME,
  description: "Generates a single block (hero, richText, cta, image, divider, form) from block type, context, and tone. Output is block JSON compatible with renderBlock.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Generate block input",
    required: ["blockType", "context", "tone"],
    properties: {
      blockType: { type: "string", description: "Block type: hero, richText, cta, image, divider, form" },
      context: { type: "string", description: "Context or description for block content" },
      tone: { type: "string", description: "Tone of voice (e.g. enterprise, warm, neutral)" },
    },
  },
  outputSchema: {
    type: "object",
    description: "Block compatible with renderBlock (id, type, data)",
    required: ["id", "type", "data"],
    properties: {
      id: { type: "string", description: "Block id" },
      type: { type: "string", description: "Block type" },
      data: { type: "object", description: "Block data for renderBlock" },
    },
  },
  safetyConstraints: [
    { code: "no_raw_html", description: "Block data uses plain text only; no raw HTML in strings.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateBlockCapability);

export type GenerateBlockInput = {
  blockType: string;
  context: string;
  tone: string;
  /** Optional locale for copy (default nb). */
  locale?: "nb" | "en";
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function buildHero(id: string, context: string, tone: string, locale: string): BlockNode {
  const isEn = locale === "en";
  const title = context.slice(0, 120) || (isEn ? "Headline" : "Overskrift");
  const subtitle = isEn ? "Supporting line." : "Undertekst.";
  return {
    id,
    type: "hero",
    data: {
      title,
      subtitle,
      imageUrl: "",
      imageAlt: "",
      ctaLabel: isEn ? "Get started" : "Kom i gang",
      ctaHref: "#",
    },
  };
}

function buildRichText(id: string, context: string, _tone: string, locale: string): BlockNode {
  const isEn = locale === "en";
  const body = context.slice(0, 2000) || (isEn ? "Content goes here." : "Innhold her.");
  return {
    id,
    type: "richText",
    data: {
      heading: isEn ? "Section" : "Seksjon",
      body,
    },
  };
}

function buildCta(id: string, context: string, _tone: string, locale: string): BlockNode {
  const isEn = locale === "en";
  const title = context.slice(0, 80) || (isEn ? "Ready to get started?" : "Klar for å komme i gang?");
  return {
    id,
    type: "cta",
    data: {
      title,
      body: isEn ? "Contact us for more information." : "Kontakt oss for mer informasjon.",
      buttonLabel: isEn ? "Contact" : "Kontakt",
      buttonHref: "#kontakt",
    },
  };
}

function buildImage(id: string, context: string, _tone: string, locale: string): BlockNode {
  const isEn = locale === "en";
  const alt = context.slice(0, 200) || (isEn ? "Image" : "Bilde");
  return {
    id,
    type: "image",
    data: {
      assetPath: "",
      alt,
      caption: "",
    },
  };
}

function buildDivider(id: string): BlockNode {
  return {
    id,
    type: "divider",
    data: { style: "line" },
  };
}

function buildForm(id: string, _context: string, _tone: string, locale: string): BlockNode {
  const isEn = locale === "en";
  return {
    id,
    type: "form",
    data: {
      formId: "",
      title: isEn ? "Form" : "Skjema",
    },
  };
}

/**
 * Generates a single block JSON compatible with renderBlock (id, type, data).
 * Deterministic from blockType, context, tone; no LLM.
 */
export function generateBlock(input: GenerateBlockInput): BlockNode {
  const blockType = safeStr(input.blockType) || "richText";
  const context = safeStr(input.context);
  const tone = safeStr(input.tone) || "neutral";
  const locale = input.locale === "en" ? "en" : "nb";
  const id = newBlockId();

  const resolvedType: GenerateBlockType = isGenerateBlockType(blockType) ? blockType : "richText";

  switch (resolvedType) {
    case "hero":
      return buildHero(id, context, tone, locale);
    case "richText":
      return buildRichText(id, context, tone, locale);
    case "cta":
      return buildCta(id, context, tone, locale);
    case "image":
      return buildImage(id, context, tone, locale);
    case "divider":
      return buildDivider(id);
    case "form":
      return buildForm(id, context, tone, locale);
    default:
      return buildRichText(id, context, tone, locale);
  }
}

export { generateBlockCapability, CAPABILITY_NAME };
