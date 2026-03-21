/**
 * Keyword opportunity engine capability: discoverKeywordGaps.
 * Discovers keyword gaps: terms in target/seed list not covered by current content,
 * plus optional question and long-tail variants. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "discoverKeywordGaps";

const discoverKeywordGapsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Keyword opportunity engine: discovers keyword gaps from current vs target/seed keywords. Returns opportunities: keyword, type (missing, long_tail, question, related), priority, suggestion. Use currentKeywords (what you cover) and seedKeywords or targetKeywords (candidates). Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Discover keyword gaps input",
    properties: {
      currentKeywords: {
        type: "array",
        description: "Keywords/topics already covered by the site",
        items: { type: "string" },
      },
      seedKeywords: {
        type: "array",
        description: "Seed terms to expand and compare (e.g. product names, themes)",
        items: { type: "string" },
      },
      targetKeywords: {
        type: "array",
        description: "Target or competitor keywords to check for gaps",
        items: { type: "string" },
      },
      includeQuestionVariants: {
        type: "boolean",
        description: "Suggest question-form opportunities (e.g. 'best X' -> 'what is the best X')",
      },
      includeLongTail: {
        type: "boolean",
        description: "Suggest long-tail variants (e.g. add 'guide', 'tips')",
      },
      maxResults: { type: "number", description: "Max opportunities to return (default: 20)" },
      locale: { type: "string", description: "Locale (nb | en) for suggestion copy" },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "Keyword gap opportunities",
    required: ["opportunities", "summary", "discoveredAt"],
    properties: {
      opportunities: {
        type: "array",
        items: {
          type: "object",
          required: ["keyword", "type", "priority", "suggestion"],
          properties: {
            keyword: { type: "string" },
            type: { type: "string", enum: ["missing", "long_tail", "question", "related"] },
            priority: { type: "string", enum: ["high", "medium", "low"] },
            suggestion: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
      discoveredAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is opportunities only; no content or SEO mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(discoverKeywordGapsCapability);

export type DiscoverKeywordGapsInput = {
  currentKeywords?: string[] | null;
  seedKeywords?: string[] | null;
  targetKeywords?: string[] | null;
  includeQuestionVariants?: boolean | null;
  includeLongTail?: boolean | null;
  maxResults?: number | null;
  locale?: "nb" | "en" | null;
};

export type KeywordOpportunity = {
  keyword: string;
  type: "missing" | "long_tail" | "question" | "related";
  priority: "high" | "medium" | "low";
  suggestion: string;
};

export type DiscoverKeywordGapsOutput = {
  opportunities: KeywordOpportunity[];
  summary: string;
  discoveredAt: string;
};

const DEFAULT_MAX_RESULTS = 20;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Returns true if the candidate is already covered by current keywords (exact or substring). */
function covered(candidate: string, currentNorm: Set<string>, currentPhrases: string[]): boolean {
  const cNorm = normalize(candidate);
  if (!cNorm) return true;
  if (currentNorm.has(cNorm)) return true;
  for (const p of currentPhrases) {
    const pNorm = normalize(p);
    if (pNorm && (pNorm === cNorm || pNorm.includes(cNorm) || cNorm.includes(pNorm))) return true;
  }
  return false;
}

function addUnique(arr: KeywordOpportunity[], item: KeywordOpportunity, seen: Set<string>): void {
  const key = normalize(item.keyword);
  if (seen.has(key)) return;
  seen.add(key);
  arr.push(item);
}

/**
 * Discovers keyword gaps and opportunities. Deterministic; no external calls.
 */
export function discoverKeywordGaps(input: DiscoverKeywordGapsInput = {}): DiscoverKeywordGapsOutput {
  const currentRaw = Array.isArray(input.currentKeywords) ? input.currentKeywords : [];
  const seedRaw = Array.isArray(input.seedKeywords) ? input.seedKeywords : [];
  const targetRaw = Array.isArray(input.targetKeywords) ? input.targetKeywords : [];
  const includeQuestion = input.includeQuestionVariants === true;
  const includeLongTail = input.includeLongTail !== false;
  const maxResults = Math.min(50, Math.max(1, Math.floor(Number(input.maxResults) ?? DEFAULT_MAX_RESULTS)));
  const isEn = input.locale === "en";

  const currentNorm = new Set(currentRaw.map(normalize).filter(Boolean));
  const currentPhrases = currentRaw.map(normalize).filter(Boolean);

  const opportunities: KeywordOpportunity[] = [];
  const seen = new Set<string>();

  const suggestMissing = (keyword: string, priority: "high" | "medium" | "low") => {
    const suggestion = isEn
      ? `Create content or landing page targeting "${keyword}".`
      : `Lag innhold eller landingsside som målretter «${keyword}».`;
    addUnique(opportunities, { keyword, type: "missing", priority, suggestion }, seen);
  };

  const suggestLongTail = (base: string, tail: string, keyword: string) => {
    const suggestion = isEn
      ? `Long-tail opportunity: "${keyword}" (extends "${base}").`
      : `Long-tail mulighet: «${keyword}» (utvider «${base}»).`;
    addUnique(opportunities, { keyword, type: "long_tail", priority: "medium", suggestion }, seen);
  };

  const suggestQuestion = (base: string, keyword: string) => {
    const suggestion = isEn
      ? `Question intent: "${keyword}" – consider FAQ or article.`
      : `Spørsmålsintensjon: «${keyword}» – vurder FAQ eller artikkel.`;
    addUnique(opportunities, { keyword, type: "question", priority: "high", suggestion }, seen);
  };

  const candidates = new Set<string>();
  for (const k of targetRaw) {
    const n = normalize(k);
    if (n) candidates.add(n);
  }
  for (const k of seedRaw) {
    const n = normalize(k);
    if (n) candidates.add(n);
  }

  for (const kw of candidates) {
    if (opportunities.length >= maxResults) break;
    if (covered(kw, currentNorm, currentPhrases)) continue;
    suggestMissing(kw, "high");
  }

  if (includeLongTail && opportunities.length < maxResults) {
    const longTailSuffixesEn = [" guide", " tips", " for beginners", " 2024", " comparison"];
    const longTailSuffixesNb = [" guide", " tips", " for nybegynnere", " sammenligning"];
    const suffixes = isEn ? longTailSuffixesEn : longTailSuffixesNb;
    for (const base of seedRaw) {
      if (opportunities.length >= maxResults) break;
      const n = normalize(base);
      if (!n) continue;
      for (const suf of suffixes) {
        const keyword = (n + suf).trim();
        if (covered(keyword, currentNorm, currentPhrases)) continue;
        suggestLongTail(n, suf, keyword);
        if (opportunities.length >= maxResults) break;
      }
    }
  }

  if (includeQuestion && opportunities.length < maxResults) {
    const questionPrefixesEn = ["what is ", "how to ", "best ", "why "];
    const questionPrefixesNb = ["hva er ", "hvordan ", "beste ", "hvorfor "];
    const prefixes = isEn ? questionPrefixesEn : questionPrefixesNb;
    for (const base of seedRaw) {
      if (opportunities.length >= maxResults) break;
      const n = normalize(base);
      if (!n) continue;
      for (const pre of prefixes) {
        const keyword = (pre + n).trim();
        if (covered(keyword, currentNorm, currentPhrases)) continue;
        suggestQuestion(n, keyword);
        if (opportunities.length >= maxResults) break;
      }
    }
  }

  const out = opportunities.slice(0, maxResults);
  const summary = isEn
    ? `Discovered ${out.length} keyword opportunity(ies). Prioritize missing and question intent.`
    : `Fant ${out.length} nøkkelordmulighet(er). Prioriter manglende og spørsmålsintensjon.`;

  return {
    opportunities: out,
    summary,
    discoveredAt: new Date().toISOString(),
  };
}

export { discoverKeywordGapsCapability, CAPABILITY_NAME };
