/**
 * AI image prompt generator capability: generateImagePrompt.
 * Builds image-generation prompts from structured input (subject, style, mood, constraints).
 * Deterministic; no LLM. Output suitable for DALL·E, Stable Diffusion, etc.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "generateImagePrompt";

const generateImagePromptCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Generates image-generation prompts from structured input: subject, style, mood, aspect ratio, negative prompt, and optional brand/context. Returns a main prompt and optional variants. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Image prompt generation input",
    properties: {
      subject: { type: "string", description: "Main subject or scene description" },
      style: {
        type: "string",
        description: "Visual style (e.g. minimal, photorealistic, illustration, flat)",
        enum: ["minimal", "photorealistic", "illustration", "flat", "editorial", "warm", "corporate", "custom"],
      },
      mood: { type: "string", description: "Mood or tone (e.g. calm, professional, inviting)" },
      aspectRatio: {
        type: "string",
        description: "Aspect ratio hint",
        enum: ["1:1", "16:9", "9:16", "4:3", "3:4", "2:3", "3:2"],
      },
      negativePrompt: { type: "string", description: "What to avoid in the image" },
      context: { type: "string", description: "Brand or context keywords (e.g. lunch, office, Norway)" },
      locale: { type: "string", enum: ["nb", "en"], description: "Locale for any embedded copy" },
      maxLength: { type: "number", description: "Max prompt length (default 1000)" },
    },
    required: ["subject"],
  },
  outputSchema: {
    type: "object",
    description: "Generated image prompt",
    required: ["prompt", "variants", "generatedAt"],
    properties: {
      prompt: { type: "string", description: "Primary prompt for image generation" },
      variants: { type: "array", items: { type: "string" }, description: "Alternative prompt formulations" },
      negativePrompt: { type: "string", description: "Optional negative prompt for APIs that support it" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is prompt text only; no image generation or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateImagePromptCapability);

const DEFAULT_MAX_LENGTH = 1000;
const STYLE_PHRASES: Record<string, string> = {
  minimal: "minimalist, clean composition, ample negative space",
  photorealistic: "photorealistic, high detail, natural lighting",
  illustration: "digital illustration, clear shapes, professional",
  flat: "flat design, solid colors, no shadows",
  editorial: "editorial style, magazine quality, sharp",
  warm: "warm tones, soft light, inviting",
  corporate: "corporate, professional, polished",
  custom: "",
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? String(v).trim() : "";
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 3);
  const lastComma = Math.max(cut.lastIndexOf(","), cut.lastIndexOf(" "));
  if (lastComma > max * 0.5) return cut.slice(0, lastComma).trim();
  return cut.trim();
}

export type GenerateImagePromptInput = {
  subject: string;
  style?: "minimal" | "photorealistic" | "illustration" | "flat" | "editorial" | "warm" | "corporate" | "custom" | null;
  mood?: string | null;
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "2:3" | "3:2" | null;
  negativePrompt?: string | null;
  context?: string | null;
  locale?: "nb" | "en" | null;
  maxLength?: number | null;
};

export type GenerateImagePromptOutput = {
  prompt: string;
  variants: string[];
  negativePrompt?: string;
  generatedAt: string;
};

/**
 * Builds image prompt from structured input. Deterministic; no external calls.
 */
export function generateImagePrompt(input: GenerateImagePromptInput): GenerateImagePromptOutput {
  const subject = safeStr(input.subject);
  const styleKey = input.style && STYLE_PHRASES[input.style] !== undefined ? input.style : "minimal";
  const stylePhrase = STYLE_PHRASES[styleKey];
  const mood = safeStr(input.mood);
  const context = safeStr(input.context);
  const negativePromptRaw = safeStr(input.negativePrompt);
  const maxLen = typeof input.maxLength === "number" && input.maxLength > 0 ? input.maxLength : DEFAULT_MAX_LENGTH;

  const parts: string[] = [];
  parts.push(subject || "professional scene");
  if (stylePhrase) parts.push(stylePhrase);
  if (mood) parts.push(mood);
  if (context) parts.push(context);

  const aspectHint = input.aspectRatio ? `, ${input.aspectRatio} aspect ratio` : "";
  let prompt = parts.join(", ") + aspectHint;
  prompt = truncate(prompt, maxLen);

  const variants: string[] = [];
  if (stylePhrase) {
    const alt = [subject || "professional scene", mood, context].filter(Boolean).join(", ") + stylePhrase + aspectHint;
    variants.push(truncate(alt, maxLen));
  }
  if (context && context !== prompt) {
    const contextFirst = [context, subject || "professional scene", stylePhrase, mood].filter(Boolean).join(", ") + aspectHint;
    variants.push(truncate(contextFirst, maxLen));
  }

  const negativePrompt = negativePromptRaw
    ? truncate(negativePromptRaw, 500)
    : undefined;

  return {
    prompt,
    variants: [...new Set(variants)].filter((v) => v !== prompt).slice(0, 3),
    ...(negativePrompt ? { negativePrompt } : {}),
    generatedAt: new Date().toISOString(),
  };
}

export { generateImagePromptCapability, CAPABILITY_NAME };
