/**
 * AI visual storytelling planner capability: suggestVisualNarrative.
 * Suggests a visual narrative: sequence of visual beats (hero, problem, solution, proof, CTA) with type and purpose.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "suggestVisualNarrative";

const suggestVisualNarrativeCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Suggests a visual narrative plan: ordered beats (hero, problem, solution, proof, CTA) with recommended visual type, purpose, and optional caption hint. Supports conversion-focused storytelling.",
  requiredContext: ["conversionGoal"],
  inputSchema: {
    type: "object",
    description: "Suggest visual narrative input",
    properties: {
      conversionGoal: {
        type: "string",
        description: "Primary conversion (e.g. signup, lead, purchase, book)",
      },
      maxBeats: { type: "number", description: "Max narrative beats (default 6)" },
      locale: { type: "string", description: "Locale (nb | en) for labels" },
    },
    required: ["conversionGoal"],
  },
  outputSchema: {
    type: "object",
    description: "Visual narrative plan",
    required: ["beats", "summary"],
    properties: {
      beats: {
        type: "array",
        items: {
          type: "object",
          required: ["order", "beatType", "visualType", "purpose", "placement"],
          properties: {
            order: { type: "number" },
            beatType: { type: "string", description: "hero | problem | solution | proof | action" },
            visualType: { type: "string", description: "hero_image | photo | illustration | diagram | testimonial_visual | cta_block" },
            purpose: { type: "string" },
            placement: { type: "string", description: "above_fold | mid | pre_footer" },
            captionHint: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(suggestVisualNarrativeCapability);

export type SuggestVisualNarrativeInput = {
  conversionGoal: string;
  maxBeats?: number | null;
  locale?: "nb" | "en" | null;
};

export type VisualNarrativeBeat = {
  order: number;
  beatType: "hero" | "problem" | "solution" | "proof" | "action";
  visualType: "hero_image" | "photo" | "illustration" | "diagram" | "testimonial_visual" | "cta_block";
  purpose: string;
  placement: "above_fold" | "mid" | "pre_footer";
  captionHint?: string;
};

export type SuggestVisualNarrativeOutput = {
  beats: VisualNarrativeBeat[];
  summary: string;
};

function buildBeats(isEn: boolean, goal: string): VisualNarrativeBeat[] {
  const g = goal.toLowerCase();
  const isLead = /lead|henvendelse|kontakt|demo/.test(g);
  const isPurchase = /purchase|buy|kjøp|order/.test(g);
  const isBook = /book|bestill|reserv|bord/.test(g);

  const beats: VisualNarrativeBeat[] = [
    {
      order: 1,
      beatType: "hero",
      visualType: "hero_image",
      purpose: isEn ? "Capture attention; state value in one glance." : "Fange oppmerksomhet; formidle verdi på ett blikk.",
      placement: "above_fold",
      captionHint: isEn ? "Strong, simple hero; one message." : "Tydelig, enkel hero; ett budskap.",
    },
    {
      order: 2,
      beatType: "problem",
      visualType: "illustration",
      purpose: isEn ? "Show the pain point or need your solution addresses." : "Vis problemet eller behovet løsningen adresserer.",
      placement: "above_fold",
      captionHint: isEn ? "Relatable situation or challenge." : "Gjenkjennbar situasjon eller utfordring.",
    },
    {
      order: 3,
      beatType: "solution",
      visualType: "photo",
      purpose: isEn ? "Show your product, service, or outcome in context." : "Vis produkt, tjeneste eller resultat i kontekst.",
      placement: "mid",
      captionHint: isEn ? "Real use case or benefit." : "Reelt brukstilfelle eller fordel.",
    },
    {
      order: 4,
      beatType: "proof",
      visualType: "testimonial_visual",
      purpose: isEn ? "Build trust with social proof (quote, logo, result)." : "Bygg tillit med sosial bevis (sitat, logo, resultat).",
      placement: "mid",
      captionHint: isEn ? "Customer quote or metric." : "Kundesitat eller nøkkeltall.",
    },
    {
      order: 5,
      beatType: "action",
      visualType: "cta_block",
      purpose: isEn ? "One clear next step; minimal distraction." : "Ét tydelig neste steg; minimal distraksjon.",
      placement: "pre_footer",
      captionHint: isEn ? "Single primary CTA." : "Én primær CTA.",
    },
  ];

  if (isLead || isBook) {
    beats.push({
      order: 6,
      beatType: "proof",
      visualType: "diagram",
      purpose: isEn ? "Optional: how it works or process in 3–4 steps." : "Valgfritt: slik fungerer det eller prosess i 3–4 steg.",
      placement: "mid",
      captionHint: isEn ? "Simple flow or steps." : "Enkel flyt eller steg.",
    });
  }

  return beats;
}

/**
 * Suggests a visual narrative: ordered beats with visual type, purpose, and placement.
 * Deterministic; no external calls.
 */
export function suggestVisualNarrative(input: SuggestVisualNarrativeInput): SuggestVisualNarrativeOutput {
  const isEn = input.locale === "en";
  const goal = (input.conversionGoal ?? "").trim() || (isEn ? "signup" : "registrering");
  const maxBeats = Math.min(8, Math.max(1, Math.floor(Number(input.maxBeats) ?? 6)));

  const beats = buildBeats(isEn, goal).slice(0, maxBeats);

  const summary = isEn
    ? `Visual narrative: ${beats.length} beats (hero → problem → solution → proof → action). Use for layout and asset planning.`
    : `Visuell fortelling: ${beats.length} takter (hero → problem → løsning → bevis → handling). Bruk til layout og bildeplanlegging.`;

  return {
    beats,
    summary,
  };
}

export { suggestVisualNarrativeCapability, CAPABILITY_NAME };
