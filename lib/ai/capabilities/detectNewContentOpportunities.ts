/**
 * Content opportunity detector capability: detectNewContentOpportunities.
 * Detects new content opportunities: related topics, question-based ideas, comparisons,
 * definitions, and seasonal/trend angles not yet covered by existing content.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "detectNewContentOpportunities";

const detectNewContentOpportunitiesCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Content opportunity detector: finds new content ideas not covered by existing titles—related topics, question-based, comparison, definition, and optional trend/seasonal angles. Returns suggested titles, type, rationale, priority, and source. Deterministic; no LLM.",
  requiredContext: ["topic"],
  inputSchema: {
    type: "object",
    description: "Detect new content opportunities input",
    properties: {
      topic: { type: "string", description: "Core topic or vertical" },
      existingTitles: {
        type: "array",
        description: "Existing page titles or content identifiers to avoid duplicates",
        items: { type: "string" },
      },
      seedKeywords: {
        type: "array",
        description: "Optional seed keywords for related ideas",
        items: { type: "string" },
      },
      trendHints: {
        type: "array",
        description: "Optional hints: seasonal, product_launch, event",
        items: { type: "string" },
      },
      locale: { type: "string", description: "Locale (nb | en) for suggested titles" },
      maxOpportunities: { type: "number", description: "Max opportunities to return (default 15)" },
    },
    required: ["topic"],
  },
  outputSchema: {
    type: "object",
    description: "New content opportunities",
    required: ["topic", "opportunities", "summary"],
    properties: {
      topic: { type: "string" },
      opportunities: {
        type: "array",
        items: {
          type: "object",
          required: ["suggestedTitle", "type", "rationale", "priority", "source"],
          properties: {
            suggestedTitle: { type: "string" },
            type: { type: "string", description: "how_to | question | comparison | definition | listicle | trend" },
            rationale: { type: "string" },
            priority: { type: "string", description: "high | medium | low" },
            source: { type: "string", description: "gap | related_topic | question | trend" },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is opportunity suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(detectNewContentOpportunitiesCapability);

export type DetectNewContentOpportunitiesInput = {
  topic: string;
  existingTitles?: string[] | null;
  seedKeywords?: string[] | null;
  trendHints?: string[] | null;
  locale?: "nb" | "en" | null;
  maxOpportunities?: number | null;
};

export type NewContentOpportunity = {
  suggestedTitle: string;
  type: "how_to" | "question" | "comparison" | "definition" | "listicle" | "trend";
  rationale: string;
  priority: "high" | "medium" | "low";
  source: "gap" | "related_topic" | "question" | "trend";
};

export type DetectNewContentOpportunitiesOutput = {
  topic: string;
  opportunities: NewContentOpportunity[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9æøå\s]/g, "");
}

function seemsCovered(suggestedTitle: string, existing: string[]): boolean {
  const norm = normalizeForMatch(suggestedTitle);
  for (const e of existing) {
    const en = normalizeForMatch(e);
    if (en.length >= 5 && (norm.includes(en) || en.includes(norm))) return true;
  }
  return false;
}

/**
 * Detects new content opportunities from topic and existing content. Deterministic; no external calls.
 */
export function detectNewContentOpportunities(input: DetectNewContentOpportunitiesInput): DetectNewContentOpportunitiesOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const maxOpps = Math.min(30, Math.max(1, Math.floor(Number(input.maxOpportunities) ?? 15)));

  const topic = safeStr(input.topic) || (isEn ? "Topic" : "Tema");
  const existing = Array.isArray(input.existingTitles)
    ? input.existingTitles.filter((t) => typeof t === "string").map((t) => (t as string).trim())
    : [];
  const seeds = Array.isArray(input.seedKeywords)
    ? input.seedKeywords.filter((k) => typeof k === "string").map((k) => (k as string).trim()).slice(0, 10)
    : [];
  const trends = Array.isArray(input.trendHints)
    ? input.trendHints.map((h) => (typeof h === "string" ? h.trim().toLowerCase() : "")).filter(Boolean)
    : [];

  const opportunities: NewContentOpportunity[] = [];
  const seen = new Set<string>();

  const add = (
    suggestedTitle: string,
    type: NewContentOpportunity["type"],
    rationale: string,
    priority: NewContentOpportunity["priority"],
    source: NewContentOpportunity["source"]
  ) => {
    const key = normalizeForMatch(suggestedTitle).slice(0, 60);
    if (seen.has(key) || opportunities.length >= maxOpps) return;
    if (seemsCovered(suggestedTitle, existing)) return;
    seen.add(key);
    opportunities.push({ suggestedTitle, type, rationale, priority, source });
  };

  const year = new Date().getFullYear();

  add(
    isEn ? `How to Get Started With ${topic}` : `Slik kommer du i gang med ${topic}`,
    "how_to",
    isEn ? "How-to content captures high intent search." : "Slik-gjør-du-innhold fanger høy intensjon.",
    "high",
    "gap"
  );
  add(
    isEn ? `What Is ${topic}? Definition and Overview` : `Hva er ${topic}? Definisjon og oversikt`,
    "definition",
    isEn ? "Definition pages rank for informational head terms." : "Definisjonssider rangerer for informasjonssøk.",
    "high",
    "gap"
  );
  add(
    isEn ? `${topic}: Frequently Asked Questions` : `${topic}: Vanlige spørsmål`,
    "question",
    isEn ? "FAQ captures question queries and featured snippets." : "FAQ fanger spørsmålssøk og uthevede snippeter.",
    "high",
    "question"
  );
  add(
    isEn ? `Best ${topic} Options in ${year}` : `Beste ${topic}-alternativer i ${year}`,
    "listicle",
    isEn ? "Listicles attract clicks and comparison intent." : "Listeartikler trekker klikk og sammenligningsintensjon.",
    "medium",
    "gap"
  );
  add(
    isEn ? `${topic} vs Alternatives: Which Is Right for You?` : `${topic} vs alternativer: Hva passer for deg?`,
    "comparison",
    isEn ? "Comparison content serves commercial investigation." : "Sammenligningsinnhold tjener kommersiell undersøkelse.",
    "medium",
    "related_topic"
  );

  for (const kw of seeds.slice(0, 5)) {
    if (!kw) continue;
    add(
      isEn ? `${topic} and ${kw}: What You Need to Know` : `${topic} og ${kw}: Det du bør vite`,
      "definition",
      isEn ? "Combines core topic with seed keyword." : "Kombinerer kjerne-tema med nøkkelord.",
      "medium",
      "related_topic"
    );
  }

  add(
    isEn ? `Why ${topic} Matters in ${year}` : `Hvorfor ${topic} betyr noe i ${year}`,
    "question",
    isEn ? "Addresses 'why' and relevance." : "Adresserer 'hvorfor' og relevans.",
    "medium",
    "question"
  );
  add(
    isEn ? `Common Mistakes When Using ${topic}` : `Vanlige feil når du bruker ${topic}`,
    "how_to",
    isEn ? "Problem-solution angle; strong engagement." : "Problem-løsningsvinkel; godt engasjement.",
    "medium",
    "gap"
  );

  if (trends.includes("seasonal")) {
    add(
      isEn ? `${topic} This Season: Tips and Updates` : `${topic} denne sesongen: tips og oppdateringer`,
      "trend",
      isEn ? "Seasonal angle can boost relevance." : "Sesongvinkel kan øke relevans.",
      "medium",
      "trend"
    );
  }
  if (trends.includes("product_launch") || trends.includes("event")) {
    add(
      isEn ? `${topic}: Latest Updates and What's New` : `${topic}: Siste oppdateringer og det som er nytt`,
      "trend",
      isEn ? "Timely updates support freshness signals." : "Tidsriktige oppdateringer støtter ferskhetssignaler.",
      "high",
      "trend"
    );
  }

  add(
    isEn ? `${topic} Checklist: Get Started in 5 Steps` : `${topic}-sjekkliste: Kom i gang i 5 steg`,
    "how_to",
    isEn ? "Checklist format supports action and shares." : "Sjekklisteformat støtter handling og deling.",
    "low",
    "gap"
  );
  add(
    isEn ? `When to Use ${topic} (And When Not To)` : `Når du bør bruke ${topic} (og når du ikke bør)`,
    "question",
    isEn ? "Qualification content helps consideration stage." : "Kvalifiseringsinnhold hjelper vurderingsfasen.",
    "low",
    "question"
  );

  const summary = isEn
    ? `Found ${opportunities.length} new content opportunity(ies) for «${topic}». Review and add to content calendar.`
    : `Fant ${opportunities.length} nye innholdsmulighet(er) for «${topic}». Gå gjennom og legg til i innholdskalender.`;

  return {
    topic,
    opportunities,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { detectNewContentOpportunitiesCapability, CAPABILITY_NAME };
