/**
 * AI growth experiment generator capability: generateGrowthExperiments.
 * Generates growth experiment ideas (A/B tests) for a given area and goal: hypothesis, metric, variant idea, priority.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "generateGrowthExperiments";

const generateGrowthExperimentsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Generates growth experiment ideas (A/B tests) for a given area and goal: headline, CTA, social proof, urgency, form length, layout, etc. Returns hypothesis, primary metric, variant idea, and suggested duration.",
  requiredContext: ["area", "goal"],
  inputSchema: {
    type: "object",
    description: "Growth experiment generation input",
    properties: {
      area: { type: "string", description: "Area to experiment on (e.g. landing page, checkout, onboarding)" },
      goal: { type: "string", description: "Goal (e.g. signups, conversions, engagement)" },
      locale: { type: "string", description: "Locale (nb | en) for labels and copy" },
      limit: { type: "number", description: "Max number of experiments to return (default all)" },
    },
    required: ["area", "goal"],
  },
  outputSchema: {
    type: "object",
    description: "Growth experiment suggestions",
    required: ["area", "goal", "experiments", "summary"],
    properties: {
      area: { type: "string" },
      goal: { type: "string" },
      experiments: {
        type: "array",
        items: {
          type: "object",
          required: ["type", "hypothesis", "metric", "variantIdea", "priority", "durationSuggestion"],
          properties: {
            type: { type: "string" },
            hypothesis: { type: "string" },
            metric: { type: "string" },
            variantIdea: { type: "string" },
            priority: { type: "number" },
            durationSuggestion: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is experiment ideas only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(generateGrowthExperimentsCapability);

export type GenerateGrowthExperimentsInput = {
  area: string;
  goal: string;
  locale?: "nb" | "en" | null;
  limit?: number | null;
};

export type GrowthExperimentIdea = {
  type: string;
  hypothesis: string;
  metric: string;
  variantIdea: string;
  priority: number;
  durationSuggestion: string;
};

export type GenerateGrowthExperimentsOutput = {
  area: string;
  goal: string;
  experiments: GrowthExperimentIdea[];
  summary: string;
};

type ExperimentDef = {
  type: string;
  hypothesisEn: (area: string, goal: string) => string;
  hypothesisNb: (area: string, goal: string) => string;
  metricEn: string;
  metricNb: string;
  variantIdeaEn: string;
  variantIdeaNb: string;
  durationEn: string;
  durationNb: string;
  priority: number;
};

const EXPERIMENT_DEFS: ExperimentDef[] = [
  {
    type: "headline_ab",
    hypothesisEn: (area, goal) => `Changing the headline on ${area} will improve ${goal} by clarifying value.`,
    hypothesisNb: (area, goal) => `Å endre overskriften på ${area} vil forbedre ${goal} ved å tydeliggjøre verdien.`,
    metricEn: "Click-through or conversion rate",
    metricNb: "Klikk- eller konverteringsandel",
    variantIdeaEn: "Test benefit-led vs. feature-led vs. question headline.",
    variantIdeaNb: "Test fordel vs. funksjon vs. spørsmål i overskrift.",
    durationEn: "2–4 weeks, minimum 100 conversions per variant",
    durationNb: "2–4 uker, minst 100 konverteringer per variant",
    priority: 1,
  },
  {
    type: "cta_copy",
    hypothesisEn: (area, goal) => `Different CTA copy on ${area} will increase ${goal}.`,
    hypothesisNb: (area, goal) => `Annen CTA-tekst på ${area} vil øke ${goal}.`,
    metricEn: "CTA click rate or conversion rate",
    metricNb: "CTA-klikkandel eller konverteringsandel",
    variantIdeaEn: "Test action-oriented (e.g. Get started) vs. outcome (e.g. See my results).",
    variantIdeaNb: "Test handlingsorientert (f.eks. Kom i gang) vs. resultat (f.eks. Se mine resultater).",
    durationEn: "2–3 weeks",
    durationNb: "2–3 uker",
    priority: 2,
  },
  {
    type: "cta_placement",
    hypothesisEn: (area, goal) => `Moving or duplicating the primary CTA on ${area} will improve ${goal}.`,
    hypothesisNb: (area, goal) => `Å flytte eller duplisere hoved-CTA på ${area} vil forbedre ${goal}.`,
    metricEn: "Conversion rate or scroll depth at CTA",
    metricNb: "Konverteringsandel eller scroll-dybde ved CTA",
    variantIdeaEn: "Test above fold only vs. sticky CTA vs. CTA after proof section.",
    variantIdeaNb: "Test kun over fold vs. sticky CTA vs. CTA etter bevisseksjon.",
    durationEn: "2–4 weeks",
    durationNb: "2–4 uker",
    priority: 3,
  },
  {
    type: "social_proof",
    hypothesisEn: (area, goal) => `Adding or changing social proof on ${area} will increase ${goal}.`,
    hypothesisNb: (area, goal) => `Å legge til eller endre sosialt bevis på ${area} vil øke ${goal}.`,
    metricEn: "Conversion rate or time on page",
    metricNb: "Konverteringsandel eller tid på side",
    variantIdeaEn: "Test testimonials vs. logos vs. numbers (e.g. 10k+ users).",
    variantIdeaNb: "Test anmeldelser vs. logoer vs. tall (f.eks. 10k+ brukere).",
    durationEn: "2–3 weeks",
    durationNb: "2–3 uker",
    priority: 4,
  },
  {
    type: "urgency_scarcity",
    hypothesisEn: (area, goal) => `Adding subtle urgency or scarcity on ${area} will lift ${goal} without hurting trust.`,
    hypothesisNb: (area, goal) => `Å legge til diskret hastverk eller knapphet på ${area} vil øke ${goal} uten å svekke tillit.`,
    metricEn: "Conversion rate; monitor bounce and support tickets",
    metricNb: "Konverteringsandel; overvåk frafall og supporthenvendelser",
    variantIdeaEn: "Test limited spots vs. deadline vs. no urgency (control).",
    variantIdeaNb: "Test begrensede plasser vs. frist vs. ingen hast (kontroll).",
    durationEn: "1–2 weeks",
    durationNb: "1–2 uker",
    priority: 5,
  },
  {
    type: "form_length",
    hypothesisEn: (area, goal) => `Reducing or restructuring the form on ${area} will improve ${goal}.`,
    hypothesisNb: (area, goal) => `Å redusere eller omstrukturere skjemaet på ${area} vil forbedre ${goal}.`,
    metricEn: "Form completion rate and conversion rate",
    metricNb: "Skjemafullføring og konverteringsandel",
    variantIdeaEn: "Test fewer fields vs. multi-step vs. optional fields hidden.",
    variantIdeaNb: "Test færre felt vs. flertrinns vs. valgfrie felt skjult.",
    durationEn: "3–4 weeks",
    durationNb: "3–4 uker",
    priority: 6,
  },
  {
    type: "layout_above_fold",
    hypothesisEn: (area, goal) => `Reordering content above the fold on ${area} will improve ${goal}.`,
    hypothesisNb: (area, goal) => `Å endre rekkefølgen på innhold over fold på ${area} vil forbedre ${goal}.`,
    metricEn: "Scroll depth, CTA clicks, conversion rate",
    metricNb: "Scroll-dybde, CTA-klikk, konverteringsandel",
    variantIdeaEn: "Test headline-first vs. hero image first vs. value prop first.",
    variantIdeaNb: "Test overskrift først vs. hero-bilde først vs. verdiforslag først.",
    durationEn: "2–4 weeks",
    durationNb: "2–4 uker",
    priority: 7,
  },
  {
    type: "image_hero",
    hypothesisEn: (area, goal) => `Changing the hero image or video on ${area} will affect ${goal}.`,
    hypothesisNb: (area, goal) => `Å endre hero-bilde eller -video på ${area} vil påvirke ${goal}.`,
    metricEn: "Engagement (time on page, scroll), conversion rate",
    metricNb: "Engasjement (tid på side, scroll), konverteringsandel",
    variantIdeaEn: "Test product shot vs. person/customer vs. abstract/illustration.",
    variantIdeaNb: "Test produktbilde vs. person/kunde vs. abstrakt/illustrasjon.",
    durationEn: "2–3 weeks",
    durationNb: "2–3 uker",
    priority: 8,
  },
  {
    type: "pricing_display",
    hypothesisEn: (area, goal) => `Changing how pricing is displayed on ${area} will improve ${goal}.`,
    hypothesisNb: (area, goal) => `Å endre hvordan pris vises på ${area} vil forbedre ${goal}.`,
    metricEn: "Signup or purchase rate, plan selection distribution",
    metricNb: "Registrering eller kjøpsandel, planfordeling",
    variantIdeaEn: "Test monthly default vs. annual default vs. toggle; or show vs. hide price.",
    variantIdeaNb: "Test månedlig standard vs. årlig standard vs. bryter; eller vis vs. skjul pris.",
    durationEn: "3–4 weeks",
    durationNb: "3–4 uker",
    priority: 9,
  },
  {
    type: "onboarding_step_order",
    hypothesisEn: (area, goal) => `Changing the order or number of steps in ${area} will improve ${goal}.`,
    hypothesisNb: (area, goal) => `Å endre rekkefølge eller antall steg i ${area} vil forbedre ${goal}.`,
    metricEn: "Step completion rate, time to first key action",
    metricNb: "Stegfullføring, tid til første nøkkelhandling",
    variantIdeaEn: "Test shortest path first vs. education-first vs. optional steps skipped.",
    variantIdeaNb: "Test korteste vei først vs. opplæring først vs. valgfrie steg hoppet over.",
    durationEn: "2–4 weeks",
    durationNb: "2–4 uker",
    priority: 10,
  },
];

/**
 * Generates growth experiment ideas for the given area and goal. Deterministic; no external calls.
 */
export function generateGrowthExperiments(input: GenerateGrowthExperimentsInput): GenerateGrowthExperimentsOutput {
  const area = (input.area ?? "").trim() || "the page";
  const goal = (input.goal ?? "").trim() || "conversions";
  const isEn = input.locale === "en";
  const limit =
    typeof input.limit === "number" && !Number.isNaN(input.limit) && input.limit > 0
      ? Math.min(Math.floor(input.limit), EXPERIMENT_DEFS.length)
      : EXPERIMENT_DEFS.length;

  const experiments: GrowthExperimentIdea[] = EXPERIMENT_DEFS.slice(0, limit).map((def) => ({
    type: def.type,
    hypothesis: isEn ? def.hypothesisEn(area, goal) : def.hypothesisNb(area, goal),
    metric: isEn ? def.metricEn : def.metricNb,
    variantIdea: isEn ? def.variantIdeaEn : def.variantIdeaNb,
    priority: def.priority,
    durationSuggestion: isEn ? def.durationEn : def.durationNb,
  }));

  const summary = isEn
    ? `${experiments.length} growth experiment idea(s) for "${area}" to improve ${goal}. Run one at a time and measure primary metric.`
    : `${experiments.length} veksteksperimentidé(er) for «${area}» for å forbedre ${goal}. Kjør ett om gangen og mål primærmetriken.`;

  return {
    area,
    goal,
    experiments,
    summary,
  };
}

export { generateGrowthExperimentsCapability, CAPABILITY_NAME };
