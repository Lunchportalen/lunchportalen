/**
 * AI section composition capability: suggestSectionComposition.
 * Suggests a page section composition: hero, features, social proof, CTA, FAQ with order and hints.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "suggestSectionComposition";

const suggestSectionCompositionCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Suggests a section composition for a page: hero, features, social proof, CTA, FAQ. Returns ordered sections with labels, descriptions, and content hints.",
  requiredContext: ["pagePurpose"],
  inputSchema: {
    type: "object",
    description: "Section composition input",
    properties: {
      pagePurpose: { type: "string", description: "Page purpose (e.g. landing, product, marketing)" },
      locale: { type: "string", description: "Locale (nb | en) for labels and descriptions" },
    },
    required: ["pagePurpose"],
  },
  outputSchema: {
    type: "object",
    description: "Suggested section composition",
    required: ["sections", "summary"],
    properties: {
      sections: {
        type: "array",
        items: {
          type: "object",
          required: ["key", "order", "label", "description", "contentHint"],
          properties: {
            key: { type: "string" },
            order: { type: "number" },
            label: { type: "string" },
            description: { type: "string" },
            contentHint: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is composition suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(suggestSectionCompositionCapability);

export type SuggestSectionCompositionInput = {
  pagePurpose: string;
  locale?: "nb" | "en" | null;
};

export type SectionSuggestion = {
  key: "hero" | "features" | "social_proof" | "cta" | "faq";
  order: number;
  label: string;
  description: string;
  contentHint: string;
};

export type SuggestSectionCompositionOutput = {
  sections: SectionSuggestion[];
  summary: string;
};

type SectionDef = {
  key: SectionSuggestion["key"];
  order: number;
  labelEn: string;
  labelNb: string;
  descriptionEn: string;
  descriptionNb: string;
  contentHintEn: string;
  contentHintNb: string;
};

const COMPOSITION: SectionDef[] = [
  {
    key: "hero",
    order: 1,
    labelEn: "Hero",
    labelNb: "Hero",
    descriptionEn: "Above-the-fold headline, subheadline, and primary CTA.",
    descriptionNb: "Overskrift, underoverskrift og hoved-CTA over fold.",
    contentHintEn: "One headline (5–10 words), one subheadline, one primary CTA.",
    contentHintNb: "Én overskrift (5–10 ord), én underoverskrift, én hoved-CTA.",
  },
  {
    key: "features",
    order: 2,
    labelEn: "Features",
    labelNb: "Funksjoner",
    descriptionEn: "Value props or feature highlights (icons, short copy).",
    descriptionNb: "Verdier eller funksjonspunkter (ikoner, kort tekst).",
    contentHintEn: "3–6 items; each: icon/heading + 1–2 sentences.",
    contentHintNb: "3–6 punkter; hver: ikon/overskrift + 1–2 setninger.",
  },
  {
    key: "social_proof",
    order: 3,
    labelEn: "Social proof",
    labelNb: "Sosialt bevis",
    descriptionEn: "Testimonials, logos, or trust signals.",
    descriptionNb: "Anmeldelser, logoer eller tillitssignaler.",
    contentHintEn: "2–4 testimonials or 3–6 logos; short quote or stat.",
    contentHintNb: "2–4 anmeldelser eller 3–6 logoer; kort sitat eller tall.",
  },
  {
    key: "cta",
    order: 4,
    labelEn: "CTA",
    labelNb: "Oppfordring",
    descriptionEn: "Conversion-focused block: headline, supporting copy, button.",
    descriptionNb: "Konverteringsblokk: overskrift, støttetekst, knapp.",
    contentHintEn: "One headline, 1–2 sentences, one primary button.",
    contentHintNb: "Én overskrift, 1–2 setninger, én primærknapp.",
  },
  {
    key: "faq",
    order: 5,
    labelEn: "FAQ",
    labelNb: "FAQ",
    descriptionEn: "Frequently asked questions (accordion or list).",
    descriptionNb: "Vanlige spørsmål (accordion eller liste).",
    contentHintEn: "4–8 Q&A pairs; concise answers.",
    contentHintNb: "4–8 spørsmål og svar; korte svar.",
  },
];

/**
 * Suggests section composition: hero, features, social proof, CTA, FAQ. Deterministic; no external calls.
 */
export function suggestSectionComposition(input: SuggestSectionCompositionInput): SuggestSectionCompositionOutput {
  const isEn = input.locale === "en";

  const sections: SectionSuggestion[] = COMPOSITION.map((def) => ({
    key: def.key,
    order: def.order,
    label: isEn ? def.labelEn : def.labelNb,
    description: isEn ? def.descriptionEn : def.descriptionNb,
    contentHint: isEn ? def.contentHintEn : def.contentHintNb,
  }));

  const summary = isEn
    ? "Suggested composition: hero → features → social proof → CTA → FAQ."
    : "Foreslått komposisjon: hero → funksjoner → sosialt bevis → CTA → FAQ.";

  return {
    sections,
    summary,
  };
}

export { suggestSectionCompositionCapability, CAPABILITY_NAME };
