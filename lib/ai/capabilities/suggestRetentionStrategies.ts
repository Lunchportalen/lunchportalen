/**
 * AI retention improvement capability: suggestRetentionStrategies.
 * Suggests retention strategies: onboarding, habit loops, email, in-app engagement, churn prevention,
 * win-back, loyalty, personalization, feedback, milestones. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "suggestRetentionStrategies";

const suggestRetentionStrategiesCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Suggests retention strategies: onboarding and aha moment, habit loops, email sequences, in-app engagement, churn prevention, win-back, loyalty and rewards, personalization, feedback surveys, success milestones. Optional filter by stage (activation, habit, churn_risk).",
  requiredContext: ["productContext"],
  inputSchema: {
    type: "object",
    description: "Retention strategy suggestion input",
    properties: {
      productContext: {
        type: "string",
        description: "Product context (e.g. saas, e-commerce, app, subscription)",
      },
      stage: {
        type: "string",
        description: "Optional: activation | habit | churn_risk (filter strategies by stage)",
      },
      locale: { type: "string", description: "Locale (nb | en) for labels and copy" },
      limit: { type: "number", description: "Max number of strategies to return (default all)" },
    },
    required: ["productContext"],
  },
  outputSchema: {
    type: "object",
    description: "Retention strategy suggestions",
    required: ["productContext", "strategies", "summary"],
    properties: {
      productContext: { type: "string" },
      strategies: {
        type: "array",
        items: {
          type: "object",
          required: ["type", "label", "description", "action", "metric", "priority"],
          properties: {
            type: { type: "string" },
            label: { type: "string" },
            description: { type: "string" },
            action: { type: "string" },
            metric: { type: "string" },
            priority: { type: "number" },
          },
        },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(suggestRetentionStrategiesCapability);

export type RetentionStage = "activation" | "habit" | "churn_risk";

export type SuggestRetentionStrategiesInput = {
  productContext: string;
  stage?: RetentionStage | string | null;
  locale?: "nb" | "en" | null;
  limit?: number | null;
};

export type RetentionStrategySuggestion = {
  type: string;
  label: string;
  description: string;
  action: string;
  metric: string;
  priority: number;
};

export type SuggestRetentionStrategiesOutput = {
  productContext: string;
  strategies: RetentionStrategySuggestion[];
  summary: string;
};

type StrategyDef = {
  type: string;
  stages: RetentionStage[];
  labelEn: string;
  labelNb: string;
  descriptionEn: string;
  descriptionNb: string;
  actionEn: string;
  actionNb: string;
  metricEn: string;
  metricNb: string;
  priority: number;
};

const STRATEGY_DEFS: StrategyDef[] = [
  {
    type: "onboarding_aha",
    stages: ["activation"],
    labelEn: "Onboarding and aha moment",
    labelNb: "Onboarding og aha-øyeblikk",
    descriptionEn: "Get users to their first value moment as fast as possible; define and measure time-to-aha.",
    descriptionNb: "Få brukere til første verdiopplevelse raskt; definer og mål tid-til-aha.",
    actionEn: "Map the shortest path to aha; remove friction; add progress and celebration.",
    actionNb: "Kartlegg korteste vei til aha; fjern friksjon; legg til fremdrift og feiring.",
    metricEn: "Time to first key action; Day 1 / Day 7 retention",
    metricNb: "Tid til første nøkkelhandling; Dag 1 / Dag 7-retensjon",
    priority: 1,
  },
  {
    type: "habit_loop",
    stages: ["habit"],
    labelEn: "Habit loop and frequency",
    labelNb: "Vane-løkke og frekvens",
    descriptionEn: "Encourage a repeatable behavior (daily, weekly) that ties to product value.",
    descriptionNb: "Oppmuntre til gjentatt atferd (daglig, ukentlig) knyttet til produktverdi.",
    actionEn: "Design triggers (push, email, in-app) and rewards; nudge at natural cadence.",
    actionNb: "Design triggere (varsel, e-post, in-app) og belønninger; nudge i naturlig rytme.",
    metricEn: "Weekly active users; sessions per user per week",
    metricNb: "Ukentlig aktive brukere; økter per bruker per uke",
    priority: 2,
  },
  {
    type: "email_sequence",
    stages: ["activation", "habit"],
    labelEn: "Email lifecycle sequence",
    labelNb: "E-post livssyklus-sekvens",
    descriptionEn: "Drip or lifecycle emails that educate, remind, and re-engage at the right time.",
    descriptionNb: "Drip- eller livssyklus-e-poster som informerer, minner og engasjerer på rett tid.",
    actionEn: "Segment by stage; send welcome, tips, and re-engagement; A/B test subject and timing.",
    actionNb: "Segmenter på stage; send velkomst, tips og re-engagement; A/B-test emne og timing.",
    metricEn: "Open rate, click rate, conversion from email",
    metricNb: "Åpningsrate, klikkrate, konvertering fra e-post",
    priority: 3,
  },
  {
    type: "in_app_engagement",
    stages: ["activation", "habit"],
    labelEn: "In-app engagement prompts",
    labelNb: "In-app engasjement-prompt",
    descriptionEn: "Contextual nudges and empty states that guide users to the next valuable action.",
    descriptionNb: "Kontekstuelle nudge og tomme tilstander som guider til neste verdifulle handling.",
    actionEn: "Use tooltips, checklists, and empty-state CTAs; avoid nagging.",
    actionNb: "Bruk verktøytips, sjekklister og CTA i tomme tilstander; unngå mas.",
    metricEn: "Feature adoption; completion of guided flows",
    metricNb: "Funksjonsadopsjon; fullføring av guidede flyt",
    priority: 4,
  },
  {
    type: "churn_prevention",
    stages: ["churn_risk"],
    labelEn: "Churn prevention and early warning",
    labelNb: "Churn-forebygging og tidlig varsling",
    descriptionEn: "Detect at-risk users (usage drop, support signals) and intervene before churn.",
    descriptionNb: "Oppdag brukere i risiko (bruksfall, support-signaler) og grip inn før churn.",
    actionEn: "Define risk signals; trigger outreach or in-app save flow; offer help or incentive.",
    actionNb: "Definer risikosignaler; utløs oppfølging eller in-app redningsflyt; tilby hjelp eller insentiv.",
    metricEn: "Churn rate; save rate among at-risk cohort",
    metricNb: "Churn-rate; redningsrate blant risikokohort",
    priority: 5,
  },
  {
    type: "win_back",
    stages: ["churn_risk"],
    labelEn: "Win-back and reactivation",
    labelNb: "Win-back og reaktivering",
    descriptionEn: "Re-engage lapsed or churned users with a clear reason to return.",
    descriptionNb: "Re-engasjer inaktive eller churnede brukere med tydelig grunn til å komme tilbake.",
    actionEn: "Segment by lapse length; send win-back email or offer; measure reactivation rate.",
    actionNb: "Segmenter på inaktivitet; send win-back e-post eller tilbud; mål reaktiveringsrate.",
    metricEn: "Reactivation rate; revenue from win-back cohort",
    metricNb: "Reaktiveringsrate; inntekt fra win-back-kohort",
    priority: 6,
  },
  {
    type: "loyalty_rewards",
    stages: ["habit"],
    labelEn: "Loyalty and rewards",
    labelNb: "Loyalitet og belønninger",
    descriptionEn: "Recognize and reward continued use (points, tiers, perks) to strengthen retention.",
    descriptionNb: "Gjennkjenn og belønn vedvarende bruk (poeng, nivåer, fordeler) for å styrke retensjon.",
    actionEn: "Design simple loyalty mechanic; surface progress; reward key actions.",
    actionNb: "Design enkel loyalitetsmekanikk; vis fremdrift; belønn nøkkelhandlinger.",
    metricEn: "Retention by tier; repeat usage rate",
    metricNb: "Retensjon per nivå; gjentaksbruk",
    priority: 7,
  },
  {
    type: "personalization",
    stages: ["activation", "habit"],
    labelEn: "Personalization and relevance",
    labelNb: "Personalisering og relevans",
    descriptionEn: "Tailor experience (content, recommendations, defaults) to increase relevance and stickiness.",
    descriptionNb: "Tilpass opplevelsen (innhold, anbefalinger, standarder) for økt relevans og vedhengighet.",
    actionEn: "Use preferences, behavior, or segment to personalize home, emails, and next steps.",
    actionNb: "Bruk preferanser, atferd eller segment for å personalisere hjem, e-poster og neste steg.",
    metricEn: "Engagement lift; retention by segment",
    metricNb: "Engasjementsløft; retensjon per segment",
    priority: 8,
  },
  {
    type: "feedback_survey",
    stages: ["activation", "habit", "churn_risk"],
    labelEn: "Feedback and satisfaction surveys",
    labelNb: "Tilbakemelding og tilfredshetsundersøkelser",
    descriptionEn: "Capture NPS, CSAT, or in-flow feedback to fix friction and prioritize improvements.",
    descriptionNb: "Innsaml NPS, CSAT eller tilbakemelding i flyt for å fjerne friksjon og prioritere forbedringer.",
    actionEn: "Survey at key moments (post-onboarding, post-use); close the loop on negative feedback.",
    actionNb: "Undersøk ved nøkkeløyeblikker (etter onboarding, etter bruk); følg opp negativ tilbakemelding.",
    metricEn: "NPS, CSAT; correlation with retention",
    metricNb: "NPS, CSAT; korrelasjon med retensjon",
    priority: 9,
  },
  {
    type: "success_milestones",
    stages: ["activation", "habit"],
    labelEn: "Success milestones and celebration",
    labelNb: "Suksessmilepæler og feiring",
    descriptionEn: "Make progress visible (badges, milestones) and celebrate wins to reinforce commitment.",
    descriptionNb: "Gjør fremdrift synlig (badges, milepæler) og feir suksesser for å styrke forpliktelse.",
    actionEn: "Define 3–5 key milestones; notify and celebrate; link to next goal.",
    actionNb: "Definer 3–5 nøkkelmilepæler; varsle og feir; lenk til neste mål.",
    metricEn: "Milestone completion rate; retention after milestone",
    metricNb: "Milepælfullføring; retensjon etter milepæl",
    priority: 10,
  },
];

function filterByStage(def: StrategyDef, stage: string | null): boolean {
  if (!stage || stage.trim() === "") return true;
  const s = stage.trim().toLowerCase() as RetentionStage;
  return def.stages.includes(s);
}

/**
 * Suggests retention strategies for the given product context and optional stage. Deterministic; no external calls.
 */
export function suggestRetentionStrategies(input: SuggestRetentionStrategiesInput): SuggestRetentionStrategiesOutput {
  const productContext = (input.productContext ?? "").trim() || "product";
  const stage = typeof input.stage === "string" ? input.stage.trim() : null;
  const isEn = input.locale === "en";
  const limit =
    typeof input.limit === "number" && !Number.isNaN(input.limit) && input.limit > 0
      ? Math.min(Math.floor(input.limit), STRATEGY_DEFS.length)
      : STRATEGY_DEFS.length;

  const filtered = STRATEGY_DEFS.filter((def) => filterByStage(def, stage)).slice(0, limit);

  const strategies: RetentionStrategySuggestion[] = filtered.map((def) => ({
    type: def.type,
    label: isEn ? def.labelEn : def.labelNb,
    description: isEn ? def.descriptionEn : def.descriptionNb,
    action: isEn ? def.actionEn : def.actionNb,
    metric: isEn ? def.metricEn : def.metricNb,
    priority: def.priority,
  }));

  const summary = stage
    ? isEn
      ? `${strategies.length} retention strategy(ies) for "${productContext}" (stage: ${stage}).`
      : `${strategies.length} retensjonsstrategi(er) for «${productContext}» (stage: ${stage}).`
    : isEn
      ? `${strategies.length} retention strategy(ies) for "${productContext}".`
      : `${strategies.length} retensjonsstrategi(er) for «${productContext}».`;

  return {
    productContext,
    strategies,
    summary,
  };
}

export { suggestRetentionStrategiesCapability, CAPABILITY_NAME };
