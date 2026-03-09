/**
 * Block builder: description + optional preferredType -> one valid BlockNode.
 * Deterministic; uses canonical blockTypes and blockId. No LLM; safe fallbacks.
 */

import type { BlockNode } from "@/lib/cms/model/blockTypes";
import { newBlockId } from "@/lib/cms/model/blockId";

export const BLOCK_BUILDER_TYPES = ["hero", "richText", "cta", "image", "divider"] as const;
export type BlockBuilderType = (typeof BLOCK_BUILDER_TYPES)[number];

function isBlockBuilderType(s: string): s is BlockBuilderType {
  return (BLOCK_BUILDER_TYPES as readonly string[]).includes(s);
}

export type BlockBuilderInput = {
  description: string;
  preferredType?: string;
  locale?: string;
};

export type BlockBuilderOutput = {
  block: BlockNode;
  message: string;
  inferredType: BlockBuilderType;
};

function inferType(description: string, preferredType?: string): BlockBuilderType {
  const d = description.toLowerCase().trim();
  if (preferredType && isBlockBuilderType(preferredType)) return preferredType;
  if (/\bhero\b|\bbanner\b|hovedseksjon|toppbilde/i.test(d)) return "hero";
  if (/\bcta\b|call to action|knapp|kontakt|handling/i.test(d)) return "cta";
  if (/\bimage\b|bilde|picture|bildeblokk/i.test(d)) return "image";
  if (/\bdivider\b|skille|linje|separator/i.test(d)) return "divider";
  return "richText";
}

function buildHero(id: string, locale: string): BlockNode {
  const isEn = locale === "en";
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
}

function buildRichText(id: string, description: string, locale: string): BlockNode {
  const isEn = locale === "en";
  const heading = isEn ? "Section" : "Seksjon";
  const body = description.trim().slice(0, 2000) || (isEn ? "Content goes here." : "Innhold her.");
  return {
    id,
    type: "richText",
    data: { heading, body },
  };
}

function buildCta(id: string, locale: string): BlockNode {
  const isEn = locale === "en";
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
}

function buildImage(id: string, locale: string): BlockNode {
  const isEn = locale === "en";
  return {
    id,
    type: "image",
    data: {
      assetPath: "",
      alt: isEn ? "Image" : "Bilde",
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

export function buildBlockFromDescription(input: BlockBuilderInput): BlockBuilderOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const inferredType = inferType(input.description, input.preferredType);
  const id = newBlockId();

  let block: BlockNode;
  switch (inferredType) {
    case "hero":
      block = buildHero(id, locale);
      break;
    case "richText":
      block = buildRichText(id, input.description, locale);
      break;
    case "cta":
      block = buildCta(id, locale);
      break;
    case "image":
      block = buildImage(id, locale);
      break;
    case "divider":
      block = buildDivider(id);
      break;
    default:
      block = buildRichText(id, input.description, locale);
  }

  const message = locale === "en" ? "Block generated successfully." : "Blokk generert.";
  return { block, message, inferredType };
}

export function normalizeToBlock(raw: unknown, locale: string): { block: BlockNode; fallback: boolean } {
  const fallback = buildBlockFromDescription({ description: "", locale });
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { block: fallback.block, fallback: true };
  }
  const o = raw as Record<string, unknown>;
  const type = typeof o.type === "string" ? o.type.trim() : "";
  if (!isBlockBuilderType(type)) return { block: fallback.block, fallback: true };
  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : newBlockId();
  const data = o.data != null && typeof o.data === "object" && !Array.isArray(o.data) ? (o.data as Record<string, unknown>) : {};
  const block: BlockNode = { id, type, data };
  return { block, fallback: false };
}
export type ScreenshotBootstrapInput = {
  screenshotUrl?: string;
  description?: string;
  locale?: string;
};

/**
 * Build 2-5 blocks for screenshot/bootstrap: hero, richText, optional image, cta.
 * Uses same block shapes as buildBlockFromDescription. Deterministic.
 */
export function buildScreenshotBootstrapBlocks(input: ScreenshotBootstrapInput): { blocks: BlockNode[]; message: string } {
  const locale = input.locale === "en" ? "en" : "nb";
  const description = (input.description ?? "").trim().slice(0, 2000) || (locale === "en" ? "Content from screenshot or description." : "Innhold fra skjermbilde eller beskrivelse.");
  const blocks: BlockNode[] = [];
  blocks.push(buildHero(newBlockId(), locale));
  blocks.push(buildRichText(newBlockId(), description, locale));
  blocks.push(buildImage(newBlockId(), locale));
  blocks.push(buildCta(newBlockId(), locale));
  const message = locale === "en"
    ? "Screenshot bootstrap: 4 blocks generated."
    : "Skjermbilde-bootstrap: 4 blokker generert.";
  return { blocks, message };
}

/**
 * Normalize raw array to valid BlockNode[]. Invalid entries replaced or dropped; returns at least a safe fallback list.
 */
export function normalizeToBlockList(raw: unknown, locale: string): { blocks: BlockNode[]; message: string } {
  const fallback = buildScreenshotBootstrapBlocks({ description: "", locale });
  if (raw == null || !Array.isArray(raw)) return fallback;
  const blocks: BlockNode[] = [];
  const max = 5;
  for (let i = 0; i < Math.min(raw.length, max); i++) {
    const result = normalizeToBlock(raw[i], locale);
    blocks.push(result.block);
  }
  if (blocks.length === 0) return fallback;
  const message = locale === "en"
    ? "Returned normalized blocks from screenshot analysis."
    : "Returnerte normaliserte blokker fra skjermbildeanalyse.";
  return { blocks, message };
}

