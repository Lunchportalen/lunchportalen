/**
 * AI illustration generator capability: generateIllustration.
 * Produces illustration prompts and specs from structured input (subject, style, format, context).
 * Deterministic; no LLM. Output suitable for image APIs or designer briefs.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "generateIllustration";

const generateIllustrationCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Generates illustration prompts and specs from structured input: subject, illustration style, format, mood, and context. Returns prompt, variants, style notes, and suggested dimensions. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Illustration generation input",
    properties: {
      subject: { type: "string", description: "Main subject (e.g. lunch delivery, team meeting)" },
      style: {
        type: "string",
        description: "Illustration style",
        enum: ["line_art", "flat", "icon", "spot", "hero", "isometric", "character", "editorial", "custom"],
      },
      format: {
        type: "string",
        description: "Intended use / format",
        enum: ["hero", "spot", "icon", "inline", "social", "custom"],
      },
      mood: { type: "string", description: "Mood or tone (e.g. calm, professional, friendly)" },
      context: { type: "string", description: "Brand or context (e.g. lunch, office, Norway)" },
      locale: { type: "string", enum: ["nb", "en"] },
      maxLength: { type: "number", description: "Max prompt length (default 800)" },
    },
    required: ["subject"],
  },
  outputSchema: {
    type: "object",
    description: "Generated illustration spec",
    required: ["prompt", "variants", "styleNotes", "generatedAt"],
    properties: {
      prompt: { type: "string", description: "Primary illustration prompt" },
      variants: { type: "array", items: { type: "string" } },
      styleNotes: { type: "array", items: { type: "string" }, description: "Style/constraint notes for renderer or designer" },
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

registerCapability(generateIllustrationCapability);

const DEFAULT_MAX_LENGTH = 800;

const STYLE_PHRASES: Record<string, string> = {
  line_art: "line art illustration, clean strokes, minimal detail, vector-friendly",
  flat: "flat illustration, solid colors, no gradients, clear shapes",
  icon: "simple icon style, single concept, scalable, clear silhouette",
  spot: "spot illustration, self-contained composition, editorial quality",
  hero: "hero illustration, wide composition, strong focal point, professional",
  isometric: "isometric illustration, 3D-like perspective, clean edges",
  character: "friendly character illustration, consistent style, expressive",
  editorial: "editorial illustration, magazine style, conceptual, polished",
  custom: "",
};

const FORMAT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  hero: { width: 1200, height: 600 },
  spot: { width: 600, height: 600 },
  icon: { width: 256, height: 256 },
  inline: { width: 400, height: 300 },
  social: { width: 1200, height: 630 },
  custom: { width: 800, height: 600 },
};

const FORMAT_NEGATIVE = "blurry, photorealistic, 3D render, noisy, text in image, watermark";

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

export type GenerateIllustrationInput = {
  subject: string;
  style?: "line_art" | "flat" | "icon" | "spot" | "hero" | "isometric" | "character" | "editorial" | "custom" | null;
  format?: "hero" | "spot" | "icon" | "inline" | "social" | "custom" | null;
  mood?: string | null;
  context?: string | null;
  locale?: "nb" | "en" | null;
  maxLength?: number | null;
};

export type GenerateIllustrationOutput = {
  prompt: string;
  variants: string[];
  styleNotes: string[];
  suggestedDimensions?: { width: number; height: number };
  negativePrompt?: string;
  generatedAt: string;
};

/**
 * Builds illustration prompt and spec from structured input. Deterministic; no external calls.
 */
export function generateIllustration(input: GenerateIllustrationInput): GenerateIllustrationOutput {
  const subject = safeStr(input.subject);
  const styleKey = input.style && STYLE_PHRASES[input.style] !== undefined ? input.style : "flat";
  const stylePhrase = STYLE_PHRASES[styleKey];
  const formatKey = input.format && FORMAT_DIMENSIONS[input.format] ? input.format : "spot";
  const mood = safeStr(input.mood);
  const context = safeStr(input.context);
  const maxLen = typeof input.maxLength === "number" && input.maxLength > 0 ? input.maxLength : DEFAULT_MAX_LENGTH;

  const parts: string[] = [];
  parts.push(subject || "professional illustration");
  if (stylePhrase) parts.push(stylePhrase);
  if (mood) parts.push(mood);
  if (context) parts.push(context);

  const prompt = truncate(parts.join(", "), maxLen);

  const variants: string[] = [];
  if (stylePhrase) {
    const alt = [subject || "professional illustration", stylePhrase, context].filter(Boolean).join(", ");
    if (alt !== prompt) variants.push(truncate(alt, maxLen));
  }
  const contextFirst = [context, subject || "professional illustration", stylePhrase].filter(Boolean).join(", ");
  if (contextFirst !== prompt && !variants.includes(contextFirst)) variants.push(truncate(contextFirst, maxLen));

  const styleNotes: string[] = [];
  if (styleKey === "flat" || styleKey === "icon") styleNotes.push("Limited color palette recommended");
  if (styleKey === "line_art") styleNotes.push("Vector or high-DPI raster for sharp lines");
  if (formatKey === "icon") styleNotes.push("Single clear subject; avoid clutter");
  if (formatKey === "hero") styleNotes.push("Composition works at wide aspect ratio");

  const suggestedDimensions = FORMAT_DIMENSIONS[formatKey];
  const negativePrompt = FORMAT_NEGATIVE;

  return {
    prompt,
    variants: [...new Set(variants)].slice(0, 3),
    styleNotes,
    suggestedDimensions,
    negativePrompt,
    generatedAt: new Date().toISOString(),
  };
}

export { generateIllustrationCapability, CAPABILITY_NAME };
