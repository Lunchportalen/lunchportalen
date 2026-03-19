/**
 * Tone adaptation capability: adaptTone.
 * Modes: professional, friendly, enterprise, persuasive.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "adaptTone";

export const ADAPT_TONE_MODES = ["professional", "friendly", "enterprise", "persuasive"] as const;
export type AdaptToneMode = (typeof ADAPT_TONE_MODES)[number];

function isAdaptToneMode(s: string): s is AdaptToneMode {
  return (ADAPT_TONE_MODES as readonly string[]).includes(s);
}

const adaptToneCapability: Capability = {
  name: CAPABILITY_NAME,
  description: "Adapts content to a target tone: professional, friendly, enterprise, or persuasive. Preserves meaning and structure.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Adapt tone input",
    required: ["content", "mode"],
    properties: {
      content: { type: "string", description: "Content to adapt" },
      mode: {
        type: "string",
        description: "Target mode: professional | friendly | enterprise | persuasive",
        enum: ["professional", "friendly", "enterprise", "persuasive"],
      },
    },
  },
  outputSchema: {
    type: "object",
    description: "Tone-adapted content",
    required: ["adaptedContent", "mode"],
    properties: {
      adaptedContent: { type: "string", description: "Content adapted to the selected mode" },
      mode: { type: "string", description: "Mode that was applied" },
    },
  },
  safetyConstraints: [
    { code: "no_markup", description: "Output is plain text only; no HTML or markup.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(adaptToneCapability);

export type AdaptToneInput = {
  content: string;
  mode: AdaptToneMode;
  /** Optional locale (default nb). */
  locale?: "nb" | "en";
};

export type AdaptToneOutput = {
  adaptedContent: string;
  mode: AdaptToneMode;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalizeContent(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Adapts content to the given tone mode.
 * Deterministic stub: normalizes content; mode is applied for contract/future LLM wiring.
 */
export function adaptTone(input: AdaptToneInput): AdaptToneOutput {
  const content = safeStr(input.content);
  const mode: AdaptToneMode = isAdaptToneMode(input.mode) ? input.mode : "professional";
  const normalized = normalizeContent(content);
  return {
    adaptedContent: normalized,
    mode,
  };
}

export { adaptToneCapability, CAPABILITY_NAME };
