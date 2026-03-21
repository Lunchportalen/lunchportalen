/**
 * Screenshot layout parser capability: parseScreenshotLayout.
 * Parses a layout description (or screenshot reference) into a block structure:
 * ordered list of BlockNode (id, type, data). Deterministic; no LLM.
 * Use with layoutDescription text; screenshotUrl is accepted for contract but not processed.
 * Import this module to register the capability.
 */

import type { BlockNode } from "@/lib/cms/model/blockTypes";
import { newBlockId } from "@/lib/cms/model/blockId";
import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "parseScreenshotLayout";

const parseScreenshotLayoutCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Parses a screenshot layout description into block structure. Input: layout description text (and optional screenshotUrl). Output: blocks (id, type, data) in order. Deterministic; infers block types from keywords (hero, richText, cta, image, divider). No LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Parse screenshot layout input",
    properties: {
      layoutDescription: {
        type: "string",
        description: "Text describing the layout (e.g. 'hero at top, then 2 text sections, CTA at bottom')",
      },
      screenshotUrl: { type: "string", description: "Optional screenshot URL (for contract; not processed in deterministic path)" },
      locale: { type: "string", description: "Locale (nb | en) for block copy" },
      maxBlocks: { type: "number", description: "Max blocks to return (default 10)" },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "Parsed block structure",
    required: ["blocks"],
    properties: {
      blocks: {
        type: "array",
        description: "Block structure (id, type, data)",
        items: {
          type: "object",
          required: ["id", "type", "data"],
          properties: {
            id: { type: "string" },
            type: { type: "string" },
            data: { type: "object" },
          },
        },
      },
      blockTypes: {
        type: "array",
        description: "Ordered list of block types",
        items: { type: "string" },
      },
      message: { type: "string" },
      warnings: { type: "array", items: { type: "string" } },
    },
  },
  safetyConstraints: [
    { code: "no_user_content_injection", description: "Output uses placeholder or parsed copy only; no raw HTML.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(parseScreenshotLayoutCapability);

export type ParseScreenshotLayoutInput = {
  layoutDescription?: string | null;
  screenshotUrl?: string | null;
  locale?: "nb" | "en" | null;
  maxBlocks?: number | null;
};

export type ParseScreenshotLayoutOutput = {
  blocks: BlockNode[];
  blockTypes: string[];
  message?: string | null;
  warnings?: string[] | null;
};

type BlockTypeToken = "hero" | "richText" | "cta" | "image" | "divider";

function tokenizeLayout(description: string): BlockTypeToken[] {
  const d = description.toLowerCase().trim();
  if (!d) return ["hero", "richText", "cta"];
  const tokens: BlockTypeToken[] = [];
  const patterns: { pattern: RegExp; type: BlockTypeToken }[] = [
    { pattern: /\bhero\b|hovedseksjon|toppbilde|banner\b|headline\s*section/i, type: "hero" },
    { pattern: /\bcta\b|call\s*to\s*action|knapp(?:e)?\s*seksjon|kontakt\s*blokk|button\s*section/i, type: "cta" },
    { pattern: /\bimage\b|bilde(?:blokk)?|picture|photo\s*block/i, type: "image" },
    { pattern: /\bdivider\b|skille(?:linje)?|separator|linje/i, type: "divider" },
    { pattern: /\b(?:text|tekst|rich\s*text|section|seksjon|paragraph|avsnitt|content|innhold)(?:\s*\d*)?\b/i, type: "richText" },
  ];
  const fallbackOrder: BlockTypeToken[] = ["hero", "richText", "richText", "cta"];
  const mentioned = new Set<BlockTypeToken>();
  for (const { pattern, type } of patterns) {
    if (pattern.test(d)) mentioned.add(type);
  }
  if (mentioned.size === 0) return fallbackOrder;
  if (mentioned.has("hero")) tokens.push("hero");
  const textCount = (d.match(/\b(?:text|tekst|section|seksjon|paragraph|content|innhold)\b/gi) ?? []).length;
  const richCount = Math.min(Math.max(textCount || 1, 1), 4);
  for (let i = 0; i < richCount; i++) {
    if (mentioned.has("richText") || textCount > 0 || i === 0) tokens.push("richText");
  }
  if (mentioned.has("image")) tokens.push("image");
  if (mentioned.has("divider")) tokens.push("divider");
  if (mentioned.has("cta")) tokens.push("cta");
  if (tokens.length === 0) return fallbackOrder;
  if (!tokens.includes("hero") && tokens[0] !== "cta") tokens.unshift("hero");
  if (!tokens.includes("cta")) tokens.push("cta");
  return tokens;
}

function buildBlock(type: BlockTypeToken, id: string, locale: string, context?: string): BlockNode {
  const isEn = locale === "en";
  const ctx = (context ?? "").trim().slice(0, 500);
  switch (type) {
    case "hero":
      return {
        id,
        type: "hero",
        data: {
          title: isEn ? "Headline" : "Overskrift",
          subtitle: isEn ? "Supporting line" : "Undertekst",
          imageUrl: "",
          imageAlt: "",
          ctaLabel: isEn ? "Get started" : "Kom i gang",
          ctaHref: "#",
        },
      };
    case "richText":
      return {
        id,
        type: "richText",
        data: {
          heading: isEn ? "Section" : "Seksjon",
          body: ctx || (isEn ? "Content goes here." : "Innhold her."),
        },
      };
    case "cta":
      return {
        id,
        type: "cta",
        data: {
          title: isEn ? "Ready to get started?" : "Klar for å komme i gang?",
          body: isEn ? "Contact us for more information." : "Kontakt oss for mer informasjon.",
          buttonLabel: isEn ? "Contact" : "Kontakt",
          buttonHref: "#kontakt",
        },
      };
    case "image":
      return {
        id,
        type: "image",
        data: {
          assetPath: "",
          alt: isEn ? "Image" : "Bilde",
          caption: "",
        },
      };
    case "divider":
      return {
        id,
        type: "divider",
        data: {},
      };
    default:
      return {
        id,
        type: "richText",
        data: { heading: isEn ? "Section" : "Seksjon", body: isEn ? "Content." : "Innhold." },
      };
  }
}

/**
 * Parses layout description into block structure. Deterministic; no external calls.
 */
export function parseScreenshotLayout(input: ParseScreenshotLayoutInput = {}): ParseScreenshotLayoutOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const maxBlocks = typeof input.maxBlocks === "number" && !Number.isNaN(input.maxBlocks) && input.maxBlocks >= 1 ? Math.min(20, input.maxBlocks) : 10;
  const layoutDescription = (input.layoutDescription ?? "").trim() || (input.screenshotUrl ? (isEn ? "Layout from screenshot." : "Layout fra skjermbilde.") : "");

  const warnings: string[] = [];
  if (input.screenshotUrl && !layoutDescription) {
    warnings.push(isEn ? "screenshotUrl provided but no layoutDescription; using default layout." : "screenshotUrl angitt uten layoutDescription; bruker standard layout.");
  }

  const typeSequence = tokenizeLayout(layoutDescription);
  const types = typeSequence.slice(0, maxBlocks);
  const blocks: BlockNode[] = types.map((t, i) => buildBlock(t, newBlockId(), locale, layoutDescription));

  const message = isEn
    ? `Parsed layout: ${blocks.length} block(s) (${types.join(", ")}).`
    : `Parsert layout: ${blocks.length} blokk(er) (${types.join(", ")}).`;

  return {
    blocks,
    blockTypes: types,
    message,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

export { parseScreenshotLayoutCapability, CAPABILITY_NAME };
