/**
 * AI traffic growth suggestions capability: suggestGrowthContent.
 * Returns content and SEO-oriented suggestions to grow traffic (topics, internal links, formats).
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "suggestGrowthContent";

const suggestGrowthContentCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Suggests content and SEO actions to grow traffic: new topic ideas, internal linking, content expansion, and format suggestions.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Suggest growth content input",
    properties: {
      pageTitle: { type: "string", description: "Optional page or site title for context" },
      primaryKeyword: { type: "string", description: "Optional primary keyword to base topic ideas on" },
      existingTopics: {
        type: "array",
        description: "Optional list of existing page topics/slugs to avoid duplicates",
        items: { type: "string" },
      },
      locale: { type: "string", description: "Locale (nb | en) for suggestion copy" },
    },
  },
  outputSchema: {
    type: "object",
    description: "Traffic growth content suggestions",
    required: ["suggestions"],
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "type", "title", "description", "priority"],
          properties: {
            id: { type: "string" },
            type: { type: "string", description: "topic | internal_link | expand | format | pillar" },
            title: { type: "string" },
            description: { type: "string" },
            priority: { type: "string", description: "low | medium | high" },
            actionHint: { type: "string", description: "Optional concrete action or URL hint" },
          },
        },
      },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is suggestions only; no content mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(suggestGrowthContentCapability);

export type SuggestGrowthContentInput = {
  pageTitle?: string | null;
  primaryKeyword?: string | null;
  existingTopics?: string[] | null;
  locale?: "nb" | "en" | null;
};

export type GrowthContentSuggestion = {
  id: string;
  type: "topic" | "internal_link" | "expand" | "format" | "pillar";
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  /** Optional: concrete action or path hint. */
  actionHint?: string;
};

export type SuggestGrowthContentOutput = {
  suggestions: GrowthContentSuggestion[];
};

/** Default topic ideas (locale-aware) when no keyword is provided. */
function defaultTopicSuggestions(isEn: boolean): GrowthContentSuggestion[] {
  const topics: Array<{ id: string; titleNb: string; titleEn: string; descNb: string; descEn: string }> = [
    {
      id: "growth-topic-faq",
      titleNb: "FAQ-side",
      titleEn: "FAQ page",
      descNb: "En side med ofte stilte spørsmål øker søketreff og reduserer bounce.",
      descEn: "An FAQ page increases search visibility and reduces bounce.",
    },
    {
      id: "growth-topic-howto",
      titleNb: "Slik fungerer det / How-to",
      titleEn: "How it works / How-to",
      descNb: "Praktiske guider og steg-for-steg innhold ranker godt på lange nøkkelord.",
      descEn: "Practical guides and step-by-step content rank well for long-tail keywords.",
    },
    {
      id: "growth-topic-benefits",
      titleNb: "Fordeler og verdier",
      titleEn: "Benefits and value",
      descNb: "En dedikert side om fordeler treffer brukere i beslutningsfasen.",
      descEn: "A dedicated benefits page targets users in the decision phase.",
    },
    {
      id: "growth-topic-pricing",
      titleNb: "Priser og pakker",
      titleEn: "Pricing and packages",
      descNb: "Tydelig prisside støtter konvertering og søk (f.eks. «lunsjordning pris»).",
      descEn: "A clear pricing page supports conversion and search (e.g. «lunch scheme price»).",
    },
  ];
  return topics.map((t) => ({
    id: t.id,
    type: "topic" as const,
    title: isEn ? t.titleEn : t.titleNb,
    description: isEn ? t.descEn : t.descNb,
    priority: "medium" as const,
  }));
}

/** Internal linking suggestions. */
function internalLinkSuggestions(isEn: boolean): GrowthContentSuggestion[] {
  return [
    {
      id: "growth-link-contact",
      type: "internal_link",
      title: isEn ? "Link to contact page" : "Lenk til kontaktside",
      description: isEn
        ? "Add 1–2 contextual links to the contact page from key content to improve navigation and SEO."
        : "Legg til 1–2 kontekstuelle lenker til kontaktsiden fra viktig innhold for bedre navigasjon og SEO.",
      priority: "high",
      actionHint: "/kontakt",
    },
    {
      id: "growth-link-main",
      title: isEn ? "Link to main offering" : "Lenk til hovedtilbud",
      type: "internal_link",
      description: isEn
        ? "Link from blog or info pages to the main product/offering page to support conversion."
        : "Lenk fra informasjonssider til hovedtilbudet for å støtte konvertering.",
      priority: "high",
    },
  ];
}

/** Content expansion and format suggestions. */
function formatSuggestions(isEn: boolean): GrowthContentSuggestion[] {
  return [
    {
      id: "growth-format-lists",
      type: "format",
      title: isEn ? "Use lists and bullets" : "Bruk lister og punkter",
      description: isEn
        ? "Structured lists improve readability and can rank for featured snippets."
        : "Strukturerte lister forbedrer lesbarhet og kan rangere i uthevede snippeter.",
      priority: "medium",
    },
    {
      id: "growth-expand-intro",
      type: "expand",
      title: isEn ? "Expand intro with context" : "Utvid intro med kontekst",
      description: isEn
        ? "A 2–3 sentence intro with the main keyword helps both users and search engines."
        : "Et introavsnitt på 2–3 setninger med hovednøkkelordet hjelper både brukere og søkemotorer.",
      priority: "medium",
    },
    {
      id: "growth-pillar",
      type: "pillar",
      title: isEn ? "Create a pillar page" : "Lag en pillar-side",
      description: isEn
        ? "One comprehensive page that links to subtopics can capture broad and long-tail traffic."
        : "Én samlet side som lenker til undersider kan fange bred og long-tail trafikk.",
      priority: "low",
    },
  ];
}

/**
 * Returns traffic growth content suggestions: topics, internal linking, expansion, and format tips.
 * Optional pageTitle/primaryKeyword/existingTopics tailor topic ideas; otherwise returns default set.
 * Deterministic; no external calls.
 */
export function suggestGrowthContent(input: SuggestGrowthContentInput): SuggestGrowthContentOutput {
  const isEn = input.locale === "en";
  const keyword = (input.primaryKeyword ?? "").trim();
  const existing = new Set((input.existingTopics ?? []).map((t) => t.toLowerCase().trim()));
  const suggestions: GrowthContentSuggestion[] = [];

  if (keyword) {
    suggestions.push({
      id: "growth-topic-keyword",
      type: "topic",
      title: isEn ? `Content around «${keyword}»` : `Innhold rundt «${keyword}»`,
      description: isEn
        ? `Create a dedicated page or section targeting «${keyword}» to capture search demand.`
        : `Lag en egen side eller seksjon som målretter «${keyword}» for å fange søkeetterspørsel.`,
      priority: "high",
      actionHint: keyword.replace(/\s+/g, "-").toLowerCase(),
    });
  }

  const defaultTopics = defaultTopicSuggestions(isEn);
  for (const t of defaultTopics) {
    const key = t.title.toLowerCase();
    if (!existing.has(key) && !existing.has(t.id)) {
      suggestions.push(t);
    }
  }

  suggestions.push(...internalLinkSuggestions(isEn));
  suggestions.push(...formatSuggestions(isEn));

  return {
    suggestions,
  };
}

export { suggestGrowthContentCapability, CAPABILITY_NAME };
