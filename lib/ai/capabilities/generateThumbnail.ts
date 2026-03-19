/**
 * AI thumbnail generator capability: generateThumbnail.
 * Produces thumbnail prompts and specs from structured input (subject, context, style).
 * Deterministic; no LLM. Complements optimizeThumbnail (which optimizes existing thumbnails).
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "generateThumbnail";

const generateThumbnailCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Generates thumbnail visual prompts and specs from structured input: subject, context (card, list, social, og, avatar), style, and mood. Returns prompt, variants, suggested dimensions, and style notes. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Thumbnail generation input",
    properties: {
      subject: { type: "string", description: "Main subject (e.g. lunch dish, team, product)" },
      context: {
        type: "string",
        description: "Where thumbnail will be used (aligns with optimizeThumbnail)",
        enum: ["card", "list", "social", "og", "avatar"],
      },
      style: {
        type: "string",
        description: "Visual style",
        enum: ["photo", "illustration", "minimal", "flat", "custom"],
      },
      mood: { type: "string", description: "Mood (e.g. appetizing, professional)" },
      brandContext: { type: "string", description: "Brand or context (e.g. lunch, office)" },
      locale: { type: "string", enum: ["nb", "en"] },
      maxLength: { type: "number", description: "Max prompt length (default 600)" },
    },
    required: ["subject", "context"],
  },
  outputSchema: {
    type: "object",
    description: "Generated thumbnail spec",
    required: ["prompt", "variants", "styleNotes", "generatedAt"],
    properties: {
      prompt: { type: "string" },
      variants: { type: "array", items: { type: "string" } },
      styleNotes: { type: "array", items: { type: "string" } },
      suggestedDimensions: { type: "object", properties: { width: { type: "number" }, height: { type: "number" } } },
      negativePrompt: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is prompt/spec only; no image generation or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateThumbnailCapability);

const DEFAULT_MAX_LENGTH = 600;

const STYLE_PHRASES: Record<string, string> = {
  photo: "sharp photograph, good lighting, clear subject, thumbnail-friendly composition",
  illustration: "flat illustration, clear focal point, scalable, thumbnail size",
  minimal: "minimalist, single subject, clean background, readable at small size",
  flat: "flat design, solid colors, clear shape, works at small scale",
  custom: "",
};

/** Align with optimizeThumbnail context dimensions where applicable. */
const CONTEXT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  card: { width: 400, height: 300 },
  list: { width: 320, height: 240 },
  social: { width: 1200, height: 630 },
  og: { width: 1200, height: 630 },
  avatar: { width: 256, height: 256 },
};

const THUMBNAIL_NEGATIVE = "blurry, cluttered, text in image, watermark, too much detail, busy background";

function safeStr(v: unknown): string {
  return typeof v === "string" ? String(v).trim() : "";
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 3);
  const last = Math.max(cut.lastIndexOf(","), cut.lastIndexOf(" "));
  if (last > max * 0.5) return cut.slice(0, last).trim();
  return cut.trim();
}

export type GenerateThumbnailInput = {
  subject: string;
  context: "card" | "list" | "social" | "og" | "avatar";
  style?: "photo" | "illustration" | "minimal" | "flat" | "custom" | null;
  mood?: string | null;
  brandContext?: string | null;
  locale?: "nb" | "en" | null;
  maxLength?: number | null;
};

export type GenerateThumbnailOutput = {
  prompt: string;
  variants: string[];
  styleNotes: string[];
  suggestedDimensions?: { width: number; height: number };
  negativePrompt?: string;
  generatedAt: string;
};

/**
 * Builds thumbnail prompt and spec from structured input. Deterministic; no external calls.
 */
export function generateThumbnail(input: GenerateThumbnailInput): GenerateThumbnailOutput {
  const subject = safeStr(input.subject);
  const contextKey = input.context && CONTEXT_DIMENSIONS[input.context] ? input.context : "card";
  const styleKey = input.style && STYLE_PHRASES[input.style] !== undefined ? input.style : "photo";
  const stylePhrase = STYLE_PHRASES[styleKey];
  const mood = safeStr(input.mood);
  const brandContext = safeStr(input.brandContext);
  const maxLen = typeof input.maxLength === "number" && input.maxLength > 0 ? input.maxLength : DEFAULT_MAX_LENGTH;

  const parts: string[] = [];
  parts.push(subject || "thumbnail subject");
  if (stylePhrase) parts.push(stylePhrase);
  if (mood) parts.push(mood);
  if (brandContext) parts.push(brandContext);
  parts.push("readable at small size, strong focal point");

  const prompt = truncate(parts.join(", "), maxLen);

  const variants: string[] = [];
  const alt = [subject || "thumbnail", stylePhrase, contextKey, brandContext].filter(Boolean).join(", ");
  if (alt !== prompt) variants.push(truncate(alt, maxLen));
  const contextFirst = [brandContext, subject || "thumbnail", stylePhrase].filter(Boolean).join(", ");
  if (contextFirst !== prompt && contextFirst !== alt) variants.push(truncate(contextFirst, maxLen));

  const styleNotes: string[] = [];
  if (contextKey === "avatar") styleNotes.push("Single clear subject; works as square crop");
  if (contextKey === "social" || contextKey === "og") styleNotes.push("Safe zone for overlay text if needed; avoid critical content at edges");
  styleNotes.push("Thumbnail: avoid fine detail that gets lost at small size");

  const suggestedDimensions = CONTEXT_DIMENSIONS[contextKey];

  return {
    prompt,
    variants: [...new Set(variants)].slice(0, 3),
    styleNotes,
    suggestedDimensions,
    negativePrompt: THUMBNAIL_NEGATIVE,
    generatedAt: new Date().toISOString(),
  };
}

export { generateThumbnailCapability, CAPABILITY_NAME };
