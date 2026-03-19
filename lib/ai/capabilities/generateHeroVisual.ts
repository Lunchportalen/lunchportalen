/**
 * AI hero banner generator capability: generateHeroVisual.
 * Produces hero visual prompts and specs from structured input (headline, style, layout, context).
 * Deterministic; no LLM. Aligns with AGENTS.md (calm, one accent, mobile-safe). Output for image APIs or briefs.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "generateHeroVisual";

const generateHeroVisualCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Generates hero banner visual prompts and specs from structured input: headline/subject, style, layout hint, and context. Returns prompt, variants, dimensions, layout notes, and style constraints. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Hero visual generation input",
    properties: {
      headline: { type: "string", description: "Hero headline or main message (for context, not rendered in image)" },
      subject: { type: "string", description: "Visual subject (e.g. lunch table, team, office)" },
      style: {
        type: "string",
        description: "Hero visual style",
        enum: ["photo", "illustration", "minimal", "gradient", "split", "custom"],
      },
      layout: {
        type: "string",
        description: "Focal area / copy placement hint",
        enum: ["left", "right", "center", "full_bleed", "custom"],
      },
      mood: { type: "string", description: "Mood (e.g. calm, inviting, professional)" },
      context: { type: "string", description: "Brand or context (e.g. lunch, Norway)" },
      aspectRatio: {
        type: "string",
        enum: ["16:9", "21:9", "3:1", "2:1", "custom"],
        description: "Hero aspect ratio",
      },
      locale: { type: "string", enum: ["nb", "en"] },
      maxLength: { type: "number", description: "Max prompt length (default 1000)" },
    },
    required: ["subject"],
  },
  outputSchema: {
    type: "object",
    description: "Generated hero visual spec",
    required: ["prompt", "variants", "styleNotes", "generatedAt"],
    properties: {
      prompt: { type: "string" },
      variants: { type: "array", items: { type: "string" } },
      styleNotes: { type: "array", items: { type: "string" } },
      suggestedDimensions: { type: "object", properties: { width: { type: "number" }, height: { type: "number" } } },
      layoutHints: { type: "array", items: { type: "string" } },
      negativePrompt: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is prompt/spec only; no image generation or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateHeroVisualCapability);

const DEFAULT_MAX_LENGTH = 1000;

const STYLE_PHRASES: Record<string, string> = {
  photo: "high-quality photograph, natural lighting, professional, hero banner composition",
  illustration: "hero illustration, wide composition, strong focal point, clean and calm",
  minimal: "minimalist hero visual, ample negative space, single focal element, calm",
  gradient: "subtle gradient background, hero format, calm tones, space for overlay text",
  split: "split composition hero, clear visual half, space for headline and CTA",
  custom: "",
};

const LAYOUT_HINTS: Record<string, string[]> = {
  left: ["Focal content on left third", "Copy/CTA safe on right", "Mobile: stacks vertically"],
  right: ["Focal content on right third", "Copy/CTA safe on left", "Mobile: stacks vertically"],
  center: ["Focal content centered", "Copy overlay in lower third", "Mobile-safe center crop"],
  full_bleed: ["Full-bleed image", "Copy in safe zone (e.g. lower third)", "No critical content at edges"],
  custom: [],
};

const ASPECT_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "16:9": { width: 1920, height: 1080 },
  "21:9": { width: 2560, height: 1080 },
  "3:1": { width: 1800, height: 600 },
  "2:1": { width: 1600, height: 800 },
  custom: { width: 1440, height: 600 },
};

const HERO_NEGATIVE = "blurry, cluttered, text in image, watermark, logo in image, busy background, horizontal scroll";

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

export type GenerateHeroVisualInput = {
  headline?: string | null;
  subject: string;
  style?: "photo" | "illustration" | "minimal" | "gradient" | "split" | "custom" | null;
  layout?: "left" | "right" | "center" | "full_bleed" | "custom" | null;
  mood?: string | null;
  context?: string | null;
  aspectRatio?: "16:9" | "21:9" | "3:1" | "2:1" | "custom" | null;
  locale?: "nb" | "en" | null;
  maxLength?: number | null;
};

export type GenerateHeroVisualOutput = {
  prompt: string;
  variants: string[];
  styleNotes: string[];
  suggestedDimensions?: { width: number; height: number };
  layoutHints: string[];
  negativePrompt?: string;
  generatedAt: string;
};

/**
 * Builds hero banner visual prompt and spec. Deterministic; no external calls.
 */
export function generateHeroVisual(input: GenerateHeroVisualInput): GenerateHeroVisualOutput {
  const subject = safeStr(input.subject);
  const headline = safeStr(input.headline);
  const styleKey = input.style && STYLE_PHRASES[input.style] !== undefined ? input.style : "minimal";
  const stylePhrase = STYLE_PHRASES[styleKey];
  const layoutKey = input.layout && LAYOUT_HINTS[input.layout] ? input.layout : "center";
  const mood = safeStr(input.mood);
  const context = safeStr(input.context);
  const aspectKey = input.aspectRatio && ASPECT_DIMENSIONS[input.aspectRatio] ? input.aspectRatio : "16:9";
  const maxLen = typeof input.maxLength === "number" && input.maxLength > 0 ? input.maxLength : DEFAULT_MAX_LENGTH;

  const parts: string[] = [];
  parts.push(subject || "hero banner scene");
  if (stylePhrase) parts.push(stylePhrase);
  if (mood) parts.push(mood);
  if (context) parts.push(context);
  if (headline) parts.push("suitable for headline overlay, no text in image");

  const prompt = truncate(parts.join(", "), maxLen);

  const variants: string[] = [];
  const alt = [subject || "hero banner", stylePhrase, "wide format", context].filter(Boolean).join(", ");
  if (alt !== prompt) variants.push(truncate(alt, maxLen));
  const contextFirst = [context, subject || "hero", stylePhrase].filter(Boolean).join(", ");
  if (contextFirst !== prompt && contextFirst !== alt) variants.push(truncate(contextFirst, maxLen));

  const styleNotes: string[] = [
    "Hero: ensure no horizontal scroll on mobile (AGENTS.md S1)",
    "Single focal point; calm, professional tone",
  ];
  if (styleKey === "minimal" || styleKey === "gradient") styleNotes.push("Leave clear space for headline and one primary CTA");
  if (styleKey === "photo") styleNotes.push("Avoid busy backgrounds; subject well lit");

  const layoutHints = LAYOUT_HINTS[layoutKey] ?? [];
  const suggestedDimensions = ASPECT_DIMENSIONS[aspectKey];

  return {
    prompt,
    variants: [...new Set(variants)].slice(0, 3),
    styleNotes,
    suggestedDimensions,
    layoutHints,
    negativePrompt: HERO_NEGATIVE,
    generatedAt: new Date().toISOString(),
  };
}

export { generateHeroVisualCapability, CAPABILITY_NAME };
