/**
 * Personalized CTA engine capability: personalizeCTA.
 * Selects CTA variant (label, style, href) per slot by user segment/role and locale.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "personalizeCTA";

const personalizeCTACapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Personalized CTA engine: from user context (segmentId, role, locale) and CTA slots with per-segment/role variants, selects the matching variant per slot (label, style, href). Fallback to default when no match. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Personalize CTA input",
    properties: {
      userContext: {
        type: "object",
        description: "Current user/visitor context for CTA selection",
        properties: {
          segmentId: { type: "string", description: "e.g. new_user, active, power_user, at_risk" },
          role: { type: "string", description: "e.g. employee, company_admin" },
          locale: { type: "string", description: "nb | en" },
        },
      },
      ctaSlots: {
        type: "array",
        description: "CTA slots with variants per segment/role",
        items: {
          type: "object",
          required: ["ctaId", "variants"],
          properties: {
            ctaId: { type: "string", description: "e.g. hero_cta, footer_signup" },
            defaultLabel: { type: "string", description: "Fallback label" },
            defaultStyle: { type: "string", description: "primary | secondary | ghost" },
            defaultHref: { type: "string", description: "Fallback link" },
            variants: {
              type: "array",
              items: {
                type: "object",
                required: ["label"],
                properties: {
                  segmentId: { type: "string", description: "Target segment; empty = default" },
                  role: { type: "string", description: "Target role; empty = any" },
                  label: { type: "string" },
                  style: { type: "string", description: "primary | secondary | ghost" },
                  href: { type: "string" },
                },
              },
            },
          },
        },
      },
      locale: { type: "string", description: "Override locale (nb | en)" },
    },
    required: ["ctaSlots"],
  },
  outputSchema: {
    type: "object",
    description: "Personalized CTA result",
    required: ["personalizedCTAs", "selectedVariants", "summary", "generatedAt"],
    properties: {
      personalizedCTAs: {
        type: "array",
        description: "Selected CTA per slot (ctaId, label, style, href)",
        items: {
          type: "object",
          required: ["ctaId", "label", "matchedSegment"],
          properties: {
            ctaId: { type: "string" },
            label: { type: "string" },
            style: { type: "string" },
            href: { type: "string" },
            matchedSegment: { type: "string", description: "segmentId or 'default'" },
          },
        },
      },
      selectedVariants: {
        type: "array",
        items: {
          type: "object",
          required: ["ctaId", "label", "matchedSegment"],
          properties: {
            ctaId: { type: "string" },
            label: { type: "string" },
            style: { type: "string" },
            href: { type: "string" },
            matchedSegment: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "plain_text_only", description: "CTA labels and hrefs are plain text; no HTML or scripts.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(personalizeCTACapability);

export type CTAVariant = {
  segmentId?: string | null;
  role?: string | null;
  label: string;
  style?: string | null;
  href?: string | null;
};

export type CTASlot = {
  ctaId: string;
  defaultLabel?: string | null;
  defaultStyle?: string | null;
  defaultHref?: string | null;
  variants: CTAVariant[];
};

export type UserCTAContext = {
  segmentId?: string | null;
  role?: string | null;
  locale?: string | null;
};

export type PersonalizeCTAInput = {
  userContext?: UserCTAContext | null;
  ctaSlots: CTASlot[];
  locale?: "nb" | "en" | null;
};

export type PersonalizedCTA = {
  ctaId: string;
  label: string;
  style?: string | null;
  href?: string | null;
  matchedSegment: string;
};

export type PersonalizeCTAOutput = {
  personalizedCTAs: PersonalizedCTA[];
  selectedVariants: PersonalizedCTA[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Selects personalized CTA per slot by segment/role. Deterministic; no external calls.
 */
export function personalizeCTA(input: PersonalizeCTAInput): PersonalizeCTAOutput {
  const userContext = input.userContext && typeof input.userContext === "object" ? input.userContext : {};
  const segmentId = safeStr(userContext.segmentId).toLowerCase();
  const role = safeStr(userContext.role).toLowerCase();
  const slots = Array.isArray(input.ctaSlots) ? input.ctaSlots : [];
  const isEn = (input.locale ?? userContext.locale) === "en";

  const personalizedCTAs: PersonalizedCTA[] = [];
  const selectedVariants: PersonalizedCTA[] = [];

  for (const slot of slots) {
    const ctaId = safeStr(slot.ctaId);
    if (!ctaId) continue;

    const variants = Array.isArray(slot.variants) ? slot.variants : [];
    const defaultLabel = safeStr(slot.defaultLabel);
    const defaultStyle = slot.defaultStyle != null ? safeStr(slot.defaultStyle) : null;
    const defaultHref = slot.defaultHref != null ? safeStr(slot.defaultHref) : null;

    let label = defaultLabel;
    let style: string | null = defaultStyle;
    let href: string | null = defaultHref;
    let matchedSegment = "default";

    if (segmentId || role) {
      const matched = variants.find((v) => {
        const vSeg = safeStr(v.segmentId).toLowerCase();
        const vRole = safeStr(v.role).toLowerCase();
        const segmentMatch = !vSeg || vSeg === segmentId;
        const roleMatch = !vRole || vRole === role;
        return segmentMatch && roleMatch && safeStr(v.label).length > 0;
      });
      if (matched) {
        label = safeStr(matched.label);
        style = matched.style != null ? safeStr(matched.style) : style;
        href = matched.href != null ? safeStr(matched.href) : href;
        matchedSegment = safeStr(matched.segmentId) || safeStr(matched.role) || segmentId || role || "default";
      }
    }

    if (!label && variants.length > 0) {
      const fallback = variants.find((v) => !safeStr(v.segmentId) && !safeStr(v.role)) ?? variants[0];
      if (fallback) {
        label = safeStr(fallback.label);
        style = fallback.style != null ? safeStr(fallback.style) : style;
        href = fallback.href != null ? safeStr(fallback.href) : href;
        matchedSegment = safeStr(fallback.segmentId) || safeStr(fallback.role) || "default";
      }
    }

    if (!label) label = isEn ? "Continue" : "Fortsett";

    const item: PersonalizedCTA = {
      ctaId,
      label,
      style: style ?? undefined,
      href: href ?? undefined,
      matchedSegment,
    };
    personalizedCTAs.push(item);
    selectedVariants.push(item);
  }

  const summary = isEn
    ? `Personalized ${personalizedCTAs.length} CTA(s). Segment: ${segmentId || "none"}; role: ${role || "any"}.`
    : `Person tilpasset ${personalizedCTAs.length} CTA(er). Segment: ${segmentId || "ingen"}; rolle: ${role || "alle"}.`;

  return {
    personalizedCTAs,
    selectedVariants,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { personalizeCTACapability, CAPABILITY_NAME };
