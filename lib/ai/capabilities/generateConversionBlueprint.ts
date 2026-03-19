/**
 * AI conversion blueprint generator capability: generateConversionBlueprint.
 * Produces a conversion funnel blueprint: stages, recommended content, CTAs, and metrics to track.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "generateConversionBlueprint";

const generateConversionBlueprintCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Generates a conversion blueprint: funnel stages (e.g. awareness → interest → consideration → action), recommended content and CTAs per stage, and key metrics to track. Uses conversion goal, business type, and audience.",
  requiredContext: ["conversionGoal"],
  inputSchema: {
    type: "object",
    description: "Generate conversion blueprint input",
    properties: {
      conversionGoal: {
        type: "string",
        description: "Primary conversion (e.g. signup, purchase, lead, book, subscribe)",
      },
      businessType: { type: "string", description: "e.g. saas, restaurant, e-commerce" },
      audience: { type: "string", description: "Target audience" },
      existingPages: {
        type: "array",
        description: "Optional existing paths to map into blueprint",
        items: { type: "string" },
      },
      locale: { type: "string", description: "Locale (nb | en) for labels" },
    },
    required: ["conversionGoal"],
  },
  outputSchema: {
    type: "object",
    description: "Conversion blueprint",
    required: ["stages", "ctasByStage", "metricsToTrack", "summary"],
    properties: {
      stages: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "name", "description", "contentRecommendations", "order"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            contentRecommendations: { type: "array", items: { type: "string" } },
            order: { type: "number" },
          },
        },
      },
      ctasByStage: {
        type: "array",
        items: {
          type: "object",
          required: ["stageId", "ctas"],
          properties: {
            stageId: { type: "string" },
            ctas: { type: "array", items: { type: "object", properties: { label: { type: "string" }, action: { type: "string" }, priority: { type: "string" } } } },
          },
        },
      },
      metricsToTrack: {
        type: "array",
        items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, stageId: { type: "string" }, description: { type: "string" } } },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "recommendations_only", description: "Output is blueprint recommendations only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(generateConversionBlueprintCapability);

export type GenerateConversionBlueprintInput = {
  conversionGoal: string;
  businessType?: string | null;
  audience?: string | null;
  existingPages?: string[] | null;
  locale?: "nb" | "en" | null;
};

export type BlueprintStage = {
  id: string;
  name: string;
  description: string;
  contentRecommendations: string[];
  order: number;
};

export type BlueprintCta = {
  label: string;
  action: string;
  priority: "primary" | "secondary";
};

export type CtasByStage = {
  stageId: string;
  ctas: BlueprintCta[];
};

export type BlueprintMetric = {
  id: string;
  name: string;
  stageId: string;
  description: string;
};

export type GenerateConversionBlueprintOutput = {
  stages: BlueprintStage[];
  ctasByStage: CtasByStage[];
  metricsToTrack: BlueprintMetric[];
  summary: string;
};

const STAGE_IDS = ["awareness", "interest", "consideration", "action"] as const;

function buildStages(isEn: boolean, goal: string): BlueprintStage[] {
  const g = goal.toLowerCase();
  const isLead = /lead|henvendelse|kontakt|demo|prøv/.test(g);
  const isPurchase = /purchase|buy|kjøp|bestill|order/.test(g);
  const isSignup = /signup|registrer|abonner|subscribe/.test(g);
  const isBook = /book|bestill|reserv|bord/.test(g);

  return [
    {
      id: "awareness",
      name: isEn ? "Awareness" : "Bevissthet",
      description: isEn
        ? "Reach and attract the right audience; clarify value quickly."
        : "Nå og tiltrekke riktig målgruppe; tydeliggjør verdi raskt.",
      contentRecommendations: [
        isEn ? "Hero with clear value proposition" : "Hero med tydelig verdi proposisjon",
        isEn ? "Short intro (who, what, for whom)" : "Kort intro (hvem, hva, for hvem)",
        isEn ? "Social proof or trust signals above fold" : "Sosial bevis eller tillitssignaler over brettet",
      ],
      order: 1,
    },
    {
      id: "interest",
      name: isEn ? "Interest" : "Interesse",
      description: isEn
        ? "Deepen interest with benefits, use cases, or proof."
        : "Styrk interessen med fordeler, bruksområder eller bevis.",
      contentRecommendations: [
        isEn ? "Benefits or features section" : "Seksjon med fordeler eller funksjoner",
        isEn ? "How it works or examples" : "Slik fungerer det eller eksempler",
        isEn ? "Testimonials or case snippets" : "Tilbakemeldinger eller case-utsnitt",
      ],
      order: 2,
    },
    {
      id: "consideration",
      name: isEn ? "Consideration" : "Vurdering",
      description: isEn
        ? "Help compare options, overcome objections, and prepare to act."
        : "Hjelp med å sammenligne alternativer, overvinne innvendinger og forberede handling.",
      contentRecommendations: [
        isEn ? "Pricing or offers (if relevant)" : "Priser eller tilbud (dersom relevant)",
        isEn ? "FAQ or objection handling" : "FAQ eller håndtering av innvendinger",
        isEn ? "Comparison or checklist" : "Sammenligning eller sjekkliste",
      ],
      order: 3,
    },
    {
      id: "action",
      name: isEn ? "Action" : "Handling",
      description: isEn
        ? "One clear next step: sign up, buy, book, or contact."
        : "Ét tydelig neste steg: registrer, kjøp, bestill eller kontakt.",
      contentRecommendations: [
        isLead ? (isEn ? "Contact form or calendar link" : "Kontaktskjema eller kalenderlenke") : isBook ? (isEn ? "Booking widget or link" : "Bestillingswidget eller lenke") : isEn ? "Sign-up or checkout entry" : "Registrering eller sjekkut-inngang",
        isEn ? "Single primary CTA, minimal friction" : "Én primær CTA, minimal friksjon",
        isEn ? "Confirmation and next-step expectations" : "Bekreftelse og forventninger om neste steg",
      ],
      order: 4,
    },
  ];
}

function buildCtasByStage(isEn: boolean, goal: string): CtasByStage[] {
  const g = goal.toLowerCase();
  const isLead = /lead|henvendelse|kontakt|demo|prøv/.test(g);
  const isPurchase = /purchase|buy|kjøp|order/.test(g);
  const isSignup = /signup|registrer|abonner|subscribe/.test(g);
  const isBook = /book|bestill|reserv|bord/.test(g);

  const actionPrimary = isLead
    ? (isEn ? "Contact us" : "Kontakt oss")
    : isBook
      ? (isEn ? "Book now" : "Bestill nå")
      : isSignup
        ? (isEn ? "Get started" : "Kom i gang")
        : isPurchase
          ? (isEn ? "Add to cart" : "Legg i handlekurv")
          : isEn ? "Continue" : "Fortsett";

  return [
    { stageId: "awareness", ctas: [{ label: actionPrimary, action: "scroll_or_click", priority: "secondary" }] },
    { stageId: "interest", ctas: [{ label: actionPrimary, action: "scroll_or_click", priority: "primary" }, { label: isEn ? "Learn more" : "Les mer", action: "expand", priority: "secondary" }] },
    { stageId: "consideration", ctas: [{ label: actionPrimary, action: "convert", priority: "primary" }, { label: isEn ? "Contact sales" : "Kontakt salg", action: "contact", priority: "secondary" }] },
    { stageId: "action", ctas: [{ label: actionPrimary, action: "convert", priority: "primary" }] },
  ];
}

function buildMetrics(isEn: boolean): BlueprintMetric[] {
  return [
    { id: "m-awareness-views", name: isEn ? "Awareness page views" : "Sidevisninger bevissthet", stageId: "awareness", description: isEn ? "Traffic to top-of-funnel pages" : "Trafikk til toppen av trakten" },
    { id: "m-interest-scroll", name: isEn ? "Interest scroll depth" : "Rulledybde interesse", stageId: "interest", description: isEn ? "Scroll depth on key content" : "Rulledybde på nøkkelinnhold" },
    { id: "m-consideration-ctr", name: isEn ? "Consideration CTA clicks" : "CTA-klikk vurdering", stageId: "consideration", description: isEn ? "Clicks to next step" : "Klikk mot neste steg" },
    { id: "m-action-conversion", name: isEn ? "Conversion rate" : "Konverteringsrate", stageId: "action", description: isEn ? "Completed goal (signup, lead, purchase)" : "Fullførte mål (registrering, lead, kjøp)" },
  ];
}

/**
 * Generates a conversion blueprint: funnel stages, content recommendations, CTAs per stage, and metrics.
 * Deterministic; no external calls.
 */
export function generateConversionBlueprint(
  input: GenerateConversionBlueprintInput
): GenerateConversionBlueprintOutput {
  const isEn = input.locale === "en";
  const goal = (input.conversionGoal ?? "").trim() || (isEn ? "signup" : "registrering");
  const businessType = (input.businessType ?? "").trim();
  const audience = (input.audience ?? "").trim();

  const stages = buildStages(isEn, goal);
  const ctasByStage = buildCtasByStage(isEn, goal);
  const metricsToTrack = buildMetrics(isEn);

  const summary = isEn
    ? `Conversion blueprint for "${goal}"${businessType ? ` (${businessType})` : ""}${audience ? `, audience: ${audience}.` : "."} Four stages: awareness → interest → consideration → action.`
    : `Konverteringsmal for «${goal}»${businessType ? ` (${businessType})` : ""}${audience ? `, målgruppe: ${audience}.` : "."} Fire stadier: bevissthet → interesse → vurdering → handling.`;

  return {
    stages,
    ctasByStage,
    metricsToTrack,
    summary,
  };
}

export { generateConversionBlueprintCapability, CAPABILITY_NAME };
