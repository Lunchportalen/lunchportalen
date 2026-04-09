/**
 * Hero image generator capability: generateHeroImagePrompt.
 * Output: prompt for image generation (brand-safe, professional).
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "generateHeroImagePrompt";

const PROMPT_MAX_LEN = 500;

const generateHeroImagePromptCapability: Capability = {
  name: CAPABILITY_NAME,
  description: "Generates a brand-safe, professional image prompt for hero/banner use. Suitable for feeding to image generation APIs.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Hero image prompt input",
    properties: {
      topic: { type: "string", description: "Page or section topic" },
      audience: { type: "string", description: "Target audience" },
      style: { type: "string", description: "Style hint (e.g. warm, minimal, professional)" },
      locale: { type: "string", description: "Locale (nb | en)" },
    },
  },
  outputSchema: {
    type: "object",
    description: "Image generation prompt",
    required: ["prompt"],
    properties: {
      prompt: { type: "string", description: "Prompt for image generation (brand-safe)" },
    },
  },
  safetyConstraints: [
    { code: "brand_safe", description: "Prompt is professional; no specific people, logos, or risky content.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateHeroImagePromptCapability);

export type GenerateHeroImagePromptInput = {
  topic?: string | null;
  audience?: string | null;
  style?: string | null;
  locale?: "nb" | "en";
};

export type GenerateHeroImagePromptOutput = {
  prompt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 3).trim() + "...";
}

/** Base prompt fragments (professional, workplace, no faces). */
const BASE_FRAGMENTS = [
  "professional photography",
  "modern office or workplace setting",
  "warm natural lighting",
  "clean composition",
  "no people or faces",
  "suitable for corporate website hero",
];

/**
 * Returns a prompt for hero image generation from topic, audience, and style.
 * Deterministic; safe for brand (no specific people, minimal risk).
 */
export function generateHeroImagePrompt(input: GenerateHeroImagePromptInput): GenerateHeroImagePromptOutput {
  const topic = safeStr(input.topic) || "lunch and delivery";
  const audience = safeStr(input.audience) || "workplace";
  const style = safeStr(input.style).toLowerCase();
  const locale = input.locale === "en" ? "en" : "nb";

  const styleHint =
    style.includes("warm") || style.includes("varm")
      ? "warm and inviting atmosphere"
      : style.includes("minimal") || style.includes("minimalist")
        ? "minimal and clean"
        : "professional and calm";

  const subject = locale === "en"
    ? `Hero image for ${topic}, target audience: ${audience}.`
    : `Hero-bilde for ${topic}, målgruppe: ${audience}.`;

  const parts = [
    subject,
    styleHint + ".",
    ...BASE_FRAGMENTS,
  ];
  const prompt = truncate(parts.join(" "), PROMPT_MAX_LEN);

  return { prompt };
}

export { generateHeroImagePromptCapability, CAPABILITY_NAME };
