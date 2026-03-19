/**
 * CTA optimizer capability: improveCTA.
 * Inputs: current CTA text. Output: higher-converting variants.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "improveCTA";

const improveCTACapability: Capability = {
  name: CAPABILITY_NAME,
  description: "Suggests higher-converting CTA variants from current button label and title. Action-specific, enterprise-friendly copy.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Improve CTA input",
    required: ["currentCtaText"],
    properties: {
      currentCtaText: {
        type: "string",
        description: "Current CTA button label and/or title (combined or single field)",
      },
      locale: { type: "string", description: "Locale (nb | en)" },
    },
  },
  outputSchema: {
    type: "object",
    description: "Higher-converting CTA variants",
    required: ["variants"],
    properties: {
      variants: {
        type: "array",
        description: "Suggested CTA variants [{ buttonLabel, title }]",
        items: {
          type: "object",
          properties: {
            buttonLabel: { type: "string" },
            title: { type: "string" },
          },
        },
      },
    },
  },
  safetyConstraints: [
    { code: "plain_text_only", description: "Variants are plain text; no HTML.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(improveCTACapability);

export type ImproveCTAInput = {
  currentCtaText: string;
  locale?: "nb" | "en";
};

export type CTAVariant = {
  buttonLabel: string;
  title: string;
};

export type ImproveCTAOutput = {
  variants: CTAVariant[];
};

const GENERIC_PATTERNS = [
  "klikk her", "click here", "submit", "send", "les mer", "read more",
  "klikk", "send inn", "submit form",
];

function isGeneric(text: string): boolean {
  const t = text.toLowerCase().trim();
  return GENERIC_PATTERNS.some((p) => t === p || t.includes(p));
}

/** High-converting CTA variants (buttonLabel + title) by locale. */
const VARIANTS_NB: CTAVariant[] = [
  { buttonLabel: "Be om demo", title: "Få en kort gjennomgang av løsningen." },
  { buttonLabel: "Kontakt oss", title: "Vi svarer på spørsmål og sender informasjon." },
  { buttonLabel: "Bestill demo", title: "Se hvordan det fungerer i praksis." },
  { buttonLabel: "Få tilbud", title: "Vi tilpasser et tilbud til deres behov." },
];

const VARIANTS_EN: CTAVariant[] = [
  { buttonLabel: "Request demo", title: "Get a short walkthrough of the solution." },
  { buttonLabel: "Contact us", title: "We answer questions and send information." },
  { buttonLabel: "Book a demo", title: "See how it works in practice." },
  { buttonLabel: "Get a quote", title: "We tailor an offer to your needs." },
];

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Returns higher-converting CTA variants from current CTA text.
 * If current text is generic, returns full set; otherwise returns alternatives including current if kept.
 */
export function improveCTA(input: ImproveCTAInput): ImproveCTAOutput {
  const current = safeStr(input.currentCtaText);
  const locale = input.locale === "en" ? "en" : "nb";
  const base = locale === "en" ? VARIANTS_EN : VARIANTS_NB;

  const variants: CTAVariant[] = [];

  if (current && !isGeneric(current)) {
    variants.push({
      buttonLabel: current,
      title: locale === "en" ? "Keep your current CTA and add a short headline above." : "Behold nåværende CTA og legg til en kort overskrift over.",
    });
  }

  for (const v of base) {
    if (variants.length >= 4) break;
    if (variants.some((x) => x.buttonLabel === v.buttonLabel)) continue;
    variants.push(v);
  }

  if (variants.length === 0) {
    variants.push(...base.slice(0, 4));
  }

  return {
    variants: variants.slice(0, 4),
  };
}

export { improveCTACapability, CAPABILITY_NAME };
