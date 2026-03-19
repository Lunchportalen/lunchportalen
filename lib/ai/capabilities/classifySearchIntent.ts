/**
 * AI search intent classifier capability: classifySearchIntent.
 * Classifies a search query into intent: informational, navigational, transactional, commercial_investigation.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "classifySearchIntent";

const classifySearchIntentCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Classifies search query intent: informational (learn, how, what), navigational (find site/page), transactional (buy, sign up, book), or commercial_investigation (compare, best, review). Returns primary intent, optional secondary, and confidence.",
  requiredContext: ["query"],
  inputSchema: {
    type: "object",
    description: "Classify search intent input",
    properties: {
      query: { type: "string", description: "Search query to classify" },
      locale: { type: "string", description: "Locale (nb | en) for label" },
    },
    required: ["query"],
  },
  outputSchema: {
    type: "object",
    description: "Search intent classification",
    required: ["primaryIntent", "secondaryIntents", "confidence", "label", "summary"],
    properties: {
      primaryIntent: {
        type: "string",
        description: "informational | navigational | transactional | commercial_investigation",
      },
      secondaryIntents: { type: "array", items: { type: "string" } },
      confidence: { type: "number", description: "0-1" },
      label: { type: "string", description: "Short human-readable label" },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is classification only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(classifySearchIntentCapability);

export type ClassifySearchIntentInput = {
  query: string;
  locale?: "nb" | "en" | null;
};

export type SearchIntentType =
  | "informational"
  | "navigational"
  | "transactional"
  | "commercial_investigation";

export type ClassifySearchIntentOutput = {
  primaryIntent: SearchIntentType;
  secondaryIntents: SearchIntentType[];
  confidence: number;
  label: string;
  summary: string;
};

const TRANSACTIONAL_PATTERNS = [
  /\b(buy|purchase|order|book|reserve|sign\s*up|register|subscribe|download|get\s*started|try\s*free)\b/i,
  /\b(kjøp|bestill|bestille|reserv|registrer|abonner|last\s*ned|kom\s*i\s*gang|prøv\s*gratis)\b/i,
];

const NAVIGATIONAL_PATTERNS = [
  /\b(login|log\s*in|sign\s*in|contact|kontakt|hjemmeside|website|official)\b/i,
  /\b(logg\s*inn|innlogging|offisiell\s*side)\b/i,
];

const COMMERCIAL_PATTERNS = [
  /\b(best|top|compare|vs|versus|review|reviews|price|pricing|cheap|alternatives)\b/i,
  /\b(beste|sammenlign|anmeldelse|anmeldelser|pris|priser|billig|alternativer)\b/i,
];

const INFORMATIONAL_PATTERNS = [
  /\b(what|how|why|when|where|guide|learn|definition|explain|tutorial)\b/i,
  /\b(hva|hvordan|hvorfor|når|hvor|veiledning|definisjon|forklaring|opplæring)\b/i,
];

function scoreIntent(query: string, patterns: RegExp[]): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  let hits = 0;
  for (const p of patterns) {
    if (p.test(query)) hits++;
  }
  return hits > 0 ? Math.min(1, 0.5 + hits * 0.2) : 0;
}

/**
 * Classifies search query intent. Deterministic; no external calls.
 */
export function classifySearchIntent(input: ClassifySearchIntentInput): ClassifySearchIntentOutput {
  const isEn = input.locale === "en";
  const query = (input.query ?? "").trim();

  const scores: Record<SearchIntentType, number> = {
    transactional: scoreIntent(query, TRANSACTIONAL_PATTERNS),
    navigational: scoreIntent(query, NAVIGATIONAL_PATTERNS),
    commercial_investigation: scoreIntent(query, COMMERCIAL_PATTERNS),
    informational: scoreIntent(query, INFORMATIONAL_PATTERNS),
  };

  const ranked = (Object.entries(scores) as [SearchIntentType, number][])
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);

  const primaryIntent: SearchIntentType =
    ranked.length > 0 ? ranked[0][0] : "informational";
  const primaryScore = scores[primaryIntent];
  const confidence = ranked.length > 0 ? primaryScore : 0.4;
  const secondaryIntents: SearchIntentType[] = ranked
    .slice(1, 3)
    .map(([intent]) => intent)
    .filter((i) => scores[i] >= 0.3);

  const labels: Record<SearchIntentType, { en: string; nb: string }> = {
    informational: { en: "Informational", nb: "Informasjonssøk" },
    navigational: { en: "Navigational", nb: "Navigasjonssøk" },
    transactional: { en: "Transactional", nb: "Transaksjonssøk" },
    commercial_investigation: { en: "Commercial investigation", nb: "Kommersiell undersøkelse" },
  };

  const label = isEn ? labels[primaryIntent].en : labels[primaryIntent].nb;

  const summary = isEn
    ? `Query classified as ${labels[primaryIntent].en} (${(confidence * 100).toFixed(0)}% confidence).`
    : `Søket klassifisert som ${labels[primaryIntent].nb} (${(confidence * 100).toFixed(0)}% konfidens).`;

  return {
    primaryIntent,
    secondaryIntents,
    confidence: Math.round(confidence * 100) / 100,
    label,
    summary,
  };
}

export { classifySearchIntentCapability, CAPABILITY_NAME };
