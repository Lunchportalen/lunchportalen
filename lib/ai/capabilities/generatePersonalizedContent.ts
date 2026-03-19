/**
 * Personalized content generator capability: generatePersonalizedContent.
 * Selects content variants per slot by user/segment context. Returns the
 * personalized combination of slot contents (headline, body, cta, etc.).
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "generatePersonalizedContent";

const generatePersonalizedContentCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Personalized content generator: from user context (segmentId, userId, locale) and content slots with per-segment variants, selects the matching variant per slot and returns combined personalized content (headline, body, cta, etc.). Fallback to default when no segment match. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Generate personalized content input",
    properties: {
      userContext: {
        type: "object",
        description: "Current user/visitor context for selection",
        properties: {
          segmentId: { type: "string", description: "e.g. new_user, active, power_user, at_risk" },
          userId: { type: "string" },
          locale: { type: "string", description: "nb | en" },
        },
      },
      contentSlots: {
        type: "array",
        description: "Slots with variants per segment; each variant has segmentId (or empty for default) and content",
        items: {
          type: "object",
          required: ["slotId", "variants"],
          properties: {
            slotId: { type: "string", description: "e.g. headline, body, cta" },
            defaultContent: { type: "string", description: "Fallback when no segment match" },
            variants: {
              type: "array",
              items: {
                type: "object",
                required: ["content"],
                properties: {
                  segmentId: { type: "string", description: "Target segment; empty/null = default" },
                  content: { type: "string" },
                },
              },
            },
          },
        },
      },
      locale: { type: "string", description: "Override locale (nb | en)" },
    },
    required: ["contentSlots"],
  },
  outputSchema: {
    type: "object",
    description: "Personalized content result",
    required: ["personalizedContent", "selectedVariants", "summary", "generatedAt"],
    properties: {
      personalizedContent: {
        type: "object",
        description: "slotId -> selected content (string)",
        additionalProperties: { type: "string" },
      },
      selectedVariants: {
        type: "array",
        items: {
          type: "object",
          required: ["slotId", "content", "matchedSegment"],
          properties: {
            slotId: { type: "string" },
            content: { type: "string" },
            matchedSegment: { type: "string", description: "segmentId that matched or 'default'" },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "plain_text_only", description: "Selected content is plain text; no HTML or scripts from variants.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generatePersonalizedContentCapability);

export type UserContext = {
  segmentId?: string | null;
  userId?: string | null;
  locale?: string | null;
};

export type ContentVariant = {
  segmentId?: string | null;
  content: string;
};

export type ContentSlot = {
  slotId: string;
  defaultContent?: string | null;
  variants: ContentVariant[];
};

export type GeneratePersonalizedContentInput = {
  userContext?: UserContext | null;
  contentSlots: ContentSlot[];
  locale?: "nb" | "en" | null;
};

export type SelectedVariant = {
  slotId: string;
  content: string;
  matchedSegment: string;
};

export type GeneratePersonalizedContentOutput = {
  personalizedContent: Record<string, string>;
  selectedVariants: SelectedVariant[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Selects personalized content per slot from variants by user segment. Deterministic; no external calls.
 */
export function generatePersonalizedContent(input: GeneratePersonalizedContentInput): GeneratePersonalizedContentOutput {
  const userContext = input.userContext && typeof input.userContext === "object" ? input.userContext : {};
  const segmentId = safeStr(userContext.segmentId).toLowerCase();
  const slots = Array.isArray(input.contentSlots) ? input.contentSlots : [];
  const isEn = (input.locale ?? userContext.locale) === "en";

  const personalizedContent: Record<string, string> = {};
  const selectedVariants: SelectedVariant[] = [];

  for (const slot of slots) {
    const slotId = safeStr(slot.slotId);
    if (!slotId) continue;

    const variants = Array.isArray(slot.variants) ? slot.variants : [];
    const defaultContent = safeStr(slot.defaultContent);

    let selected = defaultContent;
    let matchedSegment = "default";

    if (segmentId) {
      const matched = variants.find(
        (v) => safeStr(v.segmentId).toLowerCase() === segmentId && safeStr(v.content).length > 0
      );
      if (matched) {
        selected = safeStr(matched.content);
        matchedSegment = segmentId;
      }
    }

    if (!selected && variants.length > 0) {
      const fallback = variants.find((v) => !safeStr(v.segmentId)) ?? variants[0];
      if (fallback) {
        selected = safeStr(fallback.content);
        matchedSegment = safeStr(fallback.segmentId) || "default";
      }
    }

    if (!selected) selected = isEn ? "(No content)" : "(Ingen innhold)";

    personalizedContent[slotId] = selected;
    selectedVariants.push({ slotId, content: selected, matchedSegment });
  }

  const summary = isEn
    ? `Generated personalized content for ${selectedVariants.length} slot(s). Segment: ${segmentId || "none (default)"}.`
    : `Genererte person tilpasset innhold for ${selectedVariants.length} spor(er). Segment: ${segmentId || "ingen (standard)"}.`;

  return {
    personalizedContent,
    selectedVariants,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { generatePersonalizedContentCapability, CAPABILITY_NAME };
