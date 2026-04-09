/**
 * AI content opportunity finder capability: detectGrowthOpportunities.
 * Detects content growth opportunities by comparing existing titles to a set of high-value content types
 * (how-to, listicle, FAQ, comparison, definition, case study, checklist, tutorial). Returns gaps with suggested titles.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "detectGrowthOpportunities";

const detectGrowthOpportunitiesCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Detects content growth opportunities: compares existing page titles to high-value content types (how-to, listicle, FAQ, comparison, definition, case study, checklist, tutorial). Returns missing types with suggested titles and rationale.",
  requiredContext: ["topic"],
  inputSchema: {
    type: "object",
    description: "Content opportunity detection input",
    properties: {
      topic: { type: "string", description: "Topic, niche, or vertical to find opportunities for" },
      existingTitles: {
        type: "array",
        description: "Existing page titles or paths to detect coverage",
        items: { type: "string" },
      },
      locale: { type: "string", description: "Locale (nb | en) for labels and suggested titles" },
    },
    required: ["topic"],
  },
  outputSchema: {
    type: "object",
    description: "Content growth opportunities",
    required: ["topic", "opportunities", "coveredTypes", "summary"],
    properties: {
      topic: { type: "string" },
      opportunities: {
        type: "array",
        items: {
          type: "object",
          required: ["type", "label", "suggestedTitle", "rationale", "priority"],
          properties: {
            type: { type: "string" },
            label: { type: "string" },
            suggestedTitle: { type: "string" },
            rationale: { type: "string" },
            priority: { type: "number" },
          },
        },
      },
      coveredTypes: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(detectGrowthOpportunitiesCapability);

export type DetectGrowthOpportunitiesInput = {
  topic: string;
  existingTitles?: string[] | null;
  locale?: "nb" | "en" | null;
};

export type GrowthOpportunity = {
  type: string;
  label: string;
  suggestedTitle: string;
  rationale: string;
  priority: number;
};

export type DetectGrowthOpportunitiesOutput = {
  topic: string;
  opportunities: GrowthOpportunity[];
  coveredTypes: string[];
  summary: string;
};

type OpportunityDef = {
  type: string;
  labelEn: string;
  labelNb: string;
  titleEn: (topic: string) => string;
  titleNb: (topic: string) => string;
  rationaleEn: string;
  rationaleNb: string;
  signals: string[];
  priority: number;
};

const OPPORTUNITY_DEFS: OpportunityDef[] = [
  {
    type: "how_to",
    labelEn: "How-to guide",
    labelNb: "Slik gjør du-guide",
    titleEn: (t) => `How to Use ${t} [Step-by-Step]`,
    titleNb: (t) => `Slik bruker du ${t} [Steg for steg]`,
    rationaleEn: "How-to content captures high intent and ranks for long-tail queries.",
    rationaleNb: "Slik-gjør-du-innhold fanger høy intensjon og rangerer for langhaleforespørsler.",
    signals: ["how to", "how do", "guide", "step by step", "slik", "veiledning", "steg for steg"],
    priority: 1,
  },
  {
    type: "listicle",
    labelEn: "Listicle / roundup",
    labelNb: "Listeartikkel / roundup",
    titleEn: (t) => `Best ${t} [X] Options in [Year]`,
    titleNb: (t) => `Beste ${t} [X] alternativer i [år]`,
    rationaleEn: "Listicles attract clicks and support affiliate or comparison intent.",
    rationaleNb: "Listeartikler trekker klikk og støtter sammenligningsintensjon.",
    signals: ["best", "top", "list", "alternatives", "beste", "liste", "alternativer", "roundup"],
    priority: 2,
  },
  {
    type: "faq",
    labelEn: "FAQ page",
    labelNb: "FAQ-side",
    titleEn: (t) => `${t}: Frequently Asked Questions`,
    titleNb: (t) => `${t}: Vanlige spørsmål`,
    rationaleEn: "FAQ pages capture question queries and featured snippets.",
    rationaleNb: "FAQ-sider fanger spørsmålssøk og uthevede snippeter.",
    signals: ["faq", "questions", "answers", "spørsmål", "svar", "vanlige"],
    priority: 3,
  },
  {
    type: "comparison",
    labelEn: "Comparison / vs",
    labelNb: "Sammenligning / vs",
    titleEn: (t) => `${t} vs [Alternative]: Which Is Right for You?`,
    titleNb: (t) => `${t} vs [alternativ]: Hva passer for deg?`,
    rationaleEn: "Comparison content serves commercial investigation intent.",
    rationaleNb: "Sammenligningsinnhold tjener kommersiell undersøkelsesintensjon.",
    signals: ["vs", "versus", "compare", "comparison", "sammenlign", "eller"],
    priority: 4,
  },
  {
    type: "definition",
    labelEn: "Definition / glossary",
    labelNb: "Definisjon / ordliste",
    titleEn: (t) => `What Is ${t}? Definition and Overview`,
    titleNb: (t) => `Hva er ${t}? Definisjon og oversikt`,
    rationaleEn: "Definition content ranks for informational head terms.",
    rationaleNb: "Definisjonsinnhold rangerer for informasjonssøk på hovedord.",
    signals: ["what is", "definition", "glossary", "hva er", "definisjon", "ordliste"],
    priority: 5,
  },
  {
    type: "case_study",
    labelEn: "Case study",
    labelNb: "Casestudie",
    titleEn: (t) => `[Customer] Case Study: How We [Outcome] With ${t}`,
    titleNb: (t) => `[Kunde] Casestudie: Slik oppnådde vi [resultat] med ${t}`,
    rationaleEn: "Case studies build trust and support conversion.",
    rationaleNb: "Casestudier bygger tillit og støtter konvertering.",
    signals: ["case study", "casestudie", "success story", "eksempel", "resultat"],
    priority: 6,
  },
  {
    type: "checklist",
    labelEn: "Checklist / template",
    labelNb: "Sjekkliste / mal",
    titleEn: (t) => `${t} Checklist: [X] Things to [Action]`,
    titleNb: (t) => `${t} sjekkliste: [X] ting å [handling]`,
    rationaleEn: "Checklists are actionable and shareable; good for links and engagement.",
    rationaleNb: "Sjekklister er handlingsorienterte og delbare; gode for lenker og engasjement.",
    signals: ["checklist", "sjekkliste", "template", "mal", "things to", "ting å"],
    priority: 7,
  },
  {
    type: "tutorial",
    labelEn: "Tutorial / deep dive",
    labelNb: "Opplæring / dypdykk",
    titleEn: (t) => `Complete ${t} Tutorial for Beginners`,
    titleNb: (t) => `Komplett ${t}-opplæring for nybegynnere`,
    rationaleEn: "Tutorials build authority and capture learning intent.",
    rationaleNb: "Opplæringer bygger autoritet og fanger læringsintensjon.",
    signals: ["tutorial", "beginners", "learn", "opplæring", "nybegynner", "lær"],
    priority: 8,
  },
];

function titleMatchesOpportunity(title: string, def: OpportunityDef): boolean {
  const lower = title.toLowerCase();
  return def.signals.some((s) => lower.includes(s.toLowerCase()));
}

/**
 * Detects content growth opportunities by finding missing content types. Deterministic; no external calls.
 */
export function detectGrowthOpportunities(input: DetectGrowthOpportunitiesInput): DetectGrowthOpportunitiesOutput {
  const topic = (input.topic ?? "").trim() || "your topic";
  const isEn = input.locale === "en";
  const existing = Array.isArray(input.existingTitles)
    ? input.existingTitles
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  const coveredTypes: string[] = [];
  const opportunities: GrowthOpportunity[] = [];

  for (const def of OPPORTUNITY_DEFS) {
    const covered = existing.some((title) => titleMatchesOpportunity(title, def));
    if (covered) {
      coveredTypes.push(def.type);
    } else {
      opportunities.push({
        type: def.type,
        label: isEn ? def.labelEn : def.labelNb,
        suggestedTitle: isEn ? def.titleEn(topic) : def.titleNb(topic),
        rationale: isEn ? def.rationaleEn : def.rationaleNb,
        priority: def.priority,
      });
    }
  }

  const summary = isEn
    ? `Found ${opportunities.length} content opportunity type(s) for "${topic}" (${coveredTypes.length} already covered).`
    : `Fant ${opportunities.length} innholdsmulighetstype(r) for «${topic}» (${coveredTypes.length} allerede dekket).`;

  return {
    topic,
    opportunities,
    coveredTypes,
    summary,
  };
}

export { detectGrowthOpportunitiesCapability, CAPABILITY_NAME };
