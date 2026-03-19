/**
 * AI SERP competitor analyzer capability: analyzeCompetitorSERP.
 * Analyzes provided SERP results (query + list of results with title, url, snippet) to extract
 * competitor patterns: title/snippet length, domain distribution, common phrasing, and recommendations.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "analyzeCompetitorSERP";

const analyzeCompetitorSERPCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Analyzes SERP competitor data: given a query and list of SERP results (title, url, snippet), computes title/snippet length stats, domain distribution, common patterns, and actionable recommendations for outranking.",
  requiredContext: ["query"],
  inputSchema: {
    type: "object",
    description: "SERP competitor analysis input",
    properties: {
      query: { type: "string", description: "Search query / target keyword" },
      serpResults: {
        type: "array",
        description: "List of SERP results to analyze (title, url, snippet)",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            url: { type: "string" },
            snippet: { type: "string" },
          },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for labels" },
    },
    required: ["query"],
  },
  outputSchema: {
    type: "object",
    description: "SERP competitor analysis result",
    required: ["query", "competitors", "titleStats", "snippetStats", "recommendations", "summary"],
    properties: {
      query: { type: "string" },
      competitors: {
        type: "array",
        items: {
          type: "object",
          required: ["position", "domain", "title", "titleLength", "snippetLength"],
          properties: {
            position: { type: "number" },
            domain: { type: "string" },
            title: { type: "string" },
            titleLength: { type: "number" },
            snippetLength: { type: "number" },
          },
        },
      },
      titleStats: {
        type: "object",
        required: ["avgLength", "minLength", "maxLength", "recommendedMax"],
        properties: {
          avgLength: { type: "number" },
          minLength: { type: "number" },
          maxLength: { type: "number" },
          recommendedMax: { type: "number" },
        },
      },
      snippetStats: {
        type: "object",
        required: ["avgLength", "minLength", "maxLength", "recommendedMax"],
        properties: {
          avgLength: { type: "number" },
          minLength: { type: "number" },
          maxLength: { type: "number" },
          recommendedMax: { type: "number" },
        },
      },
      recommendations: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is analysis only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(analyzeCompetitorSERPCapability);

export type SerpResultInput = {
  title?: string | null;
  url?: string | null;
  snippet?: string | null;
};

export type AnalyzeCompetitorSERPInput = {
  query: string;
  serpResults?: SerpResultInput[] | null;
  locale?: "nb" | "en" | null;
};

export type SerpCompetitorEntry = {
  position: number;
  domain: string;
  title: string;
  titleLength: number;
  snippetLength: number;
};

export type AnalyzeCompetitorSERPOutput = {
  query: string;
  competitors: SerpCompetitorEntry[];
  titleStats: { avgLength: number; minLength: number; maxLength: number; recommendedMax: number };
  snippetStats: { avgLength: number; minLength: number; maxLength: number; recommendedMax: number };
  recommendations: string[];
  summary: string;
};

const TITLE_RECOMMENDED_MAX = 60;
const SNIPPET_RECOMMENDED_MAX = 155;

function extractDomain(url: string): string {
  try {
    const u = url?.trim() || "";
    if (!u) return "";
    const parsed = new URL(u.startsWith("http") ? u : `https://${u}`);
    const host = parsed.hostname || "";
    return host.replace(/^www\./i, "") || host;
  } catch {
    return (url ?? "").trim().slice(0, 50) || "";
  }
}

function safeLength(s: string | null | undefined): number {
  return typeof s === "string" ? s.trim().length : 0;
}

/**
 * Analyzes SERP competitor data. Deterministic; no external calls.
 */
export function analyzeCompetitorSERP(input: AnalyzeCompetitorSERPInput): AnalyzeCompetitorSERPOutput {
  const query = (input.query ?? "").trim();
  const isEn = input.locale === "en";
  const raw = Array.isArray(input.serpResults) ? input.serpResults : [];
  const entries = raw
    .filter((r): r is SerpResultInput => r != null && typeof r === "object")
    .map((r, i) => ({
      position: i + 1,
      title: typeof r.title === "string" ? r.title.trim() : "",
      url: typeof r.url === "string" ? r.url.trim() : "",
      snippet: typeof r.snippet === "string" ? r.snippet.trim() : "",
    }))
    .filter((e) => e.title || e.url || e.snippet);

  const competitors: SerpCompetitorEntry[] = entries.map((e) => ({
    position: e.position,
    domain: extractDomain(e.url),
    title: e.title,
    titleLength: safeLength(e.title),
    snippetLength: safeLength(e.snippet),
  }));

  const titleLengths = competitors.map((c) => c.titleLength).filter((n) => n > 0);
  const snippetLengths = competitors.map((c) => c.snippetLength).filter((n) => n > 0);

  const avg = (arr: number[]) =>
    arr.length === 0 ? 0 : Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
  const min = (arr: number[]) => (arr.length === 0 ? 0 : Math.min(...arr));
  const max = (arr: number[]) => (arr.length === 0 ? 0 : Math.max(...arr));

  const titleStats = {
    avgLength: avg(titleLengths),
    minLength: min(titleLengths),
    maxLength: max(titleLengths),
    recommendedMax: TITLE_RECOMMENDED_MAX,
  };

  const snippetStats = {
    avgLength: avg(snippetLengths),
    minLength: min(snippetLengths),
    maxLength: max(snippetLengths),
    recommendedMax: SNIPPET_RECOMMENDED_MAX,
  };

  const recommendations: string[] = [];
  if (competitors.length === 0) {
    recommendations.push(
      isEn
        ? "Provide SERP results (title, url, snippet) to get competitor analysis and recommendations."
        : "Oppgi SERP-resultater (tittel, url, snippet) for å få konkurrentanalyse og anbefalinger."
    );
  } else {
    if (titleStats.avgLength > 0) {
      if (titleStats.maxLength > TITLE_RECOMMENDED_MAX) {
        recommendations.push(
          isEn
            ? `Keep title under ${TITLE_RECOMMENDED_MAX} chars to avoid truncation; top results avg ${titleStats.avgLength}.`
            : `Hold tittelen under ${TITLE_RECOMMENDED_MAX} tegn for å unngå avkutting; toppresultater snitt ${titleStats.avgLength}.`
        );
      } else {
        recommendations.push(
          isEn
            ? `Title length in SERP: avg ${titleStats.avgLength}, max ${titleStats.maxLength}. Aim within 50–60 chars.`
            : `Tittellengde i SERP: snitt ${titleStats.avgLength}, max ${titleStats.maxLength}. Sikte på 50–60 tegn.`
        );
      }
    }
    if (snippetStats.avgLength > 0) {
      if (snippetStats.maxLength > SNIPPET_RECOMMENDED_MAX) {
        recommendations.push(
          isEn
            ? `Meta description under ${SNIPPET_RECOMMENDED_MAX} chars recommended; competitors avg ${snippetStats.avgLength}.`
            : `Meta-beskrivelse under ${SNIPPET_RECOMMENDED_MAX} tegn anbefales; konkurrenter snitt ${snippetStats.avgLength}.`
        );
      } else {
        recommendations.push(
          isEn
            ? `Snippet length: avg ${snippetStats.avgLength}, max ${snippetStats.maxLength}. Target ~155 chars for meta.`
            : `Snippet-lengde: snitt ${snippetStats.avgLength}, max ${snippetStats.maxLength}. Mål ~155 tegn for meta.`
        );
      }
    }
    if (competitors.length > 0) {
      const domains = competitors.map((c) => c.domain).filter(Boolean);
      const uniqueDomains = new Set(domains);
      if (uniqueDomains.size > 0) {
        recommendations.push(
          isEn
            ? `${competitors.length} result(s), ${uniqueDomains.size} unique domain(s). Review top titles for query alignment.`
            : `${competitors.length} resultat(er), ${uniqueDomains.size} unike domene(r). Gå gjennom topptitler for søkeordstilpasning.`
        );
      }
    }
  }

  const summary =
    competitors.length === 0
      ? isEn
        ? "No SERP data provided; add serpResults to analyze competitors."
        : "Ingen SERP-data oppgitt; legg til serpResults for å analysere konkurrenter."
      : isEn
        ? `Analyzed ${competitors.length} SERP result(s) for "${query}". Title avg ${titleStats.avgLength} chars, snippet avg ${snippetStats.avgLength} chars. ${recommendations.length} recommendation(s).`
        : `Analysert ${competitors.length} SERP-resultat(er) for «${query}». Tittel snitt ${titleStats.avgLength} tegn, snippet snitt ${snippetStats.avgLength} tegn. ${recommendations.length} anbefaling(er).`;

  return {
    query,
    competitors,
    titleStats,
    snippetStats,
    recommendations,
    summary,
  };
}

export { analyzeCompetitorSERPCapability, CAPABILITY_NAME };
