/**
 * AI page gap detector capability: detectMissingPages.
 * Uses search topics and content graph to find topics with no or weak page coverage (gaps).
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "detectMissingPages";

const detectMissingPagesCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Detects missing pages by comparing search topics (what users search for) to the content graph (existing pages). Topics with no or weak coverage are reported as gaps with suggested path and title.",
  requiredContext: ["searchTopics", "contentGraph"],
  inputSchema: {
    type: "object",
    description: "Detect missing pages input",
    properties: {
      searchTopics: {
        type: "array",
        description: "Search topics (queries or themes users search for)",
        items: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query or topic phrase" },
            volume: { type: "number", description: "Optional search volume or priority weight" },
          },
          required: ["query"],
        },
      },
      contentGraph: {
        type: "array",
        description: "Content graph: existing pages (path, title, optional keywords)",
        items: {
          type: "object",
          required: ["path", "title"],
          properties: {
            path: { type: "string" },
            title: { type: "string" },
            keywords: { type: "array", items: { type: "string" } },
            excerpt: { type: "string" },
          },
        },
      },
      minCoverageScore: {
        type: "number",
        description: "Threshold below which a topic is considered a gap (0-1, default 0.3)",
      },
      maxGaps: { type: "number", description: "Max gaps to return (default 20)" },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["searchTopics", "contentGraph"],
  },
  outputSchema: {
    type: "object",
    description: "Detected page gaps (missing pages)",
    required: ["gaps", "summary"],
    properties: {
      gaps: {
        type: "array",
        items: {
          type: "object",
          required: ["topic", "reason", "suggestedPath", "suggestedTitle", "priority"],
          properties: {
            topic: { type: "string", description: "Search topic with no/weak coverage" },
            reason: { type: "string", description: "Why this is a gap" },
            suggestedPath: { type: "string", description: "Suggested URL path for new page" },
            suggestedTitle: { type: "string", description: "Suggested page title" },
            priority: { type: "string", description: "low | medium | high" },
            coverageScore: { type: "number", description: "0-1; 0 = no coverage" },
            bestExistingPath: { type: "string", description: "Closest existing page if partial coverage" },
          },
        },
      },
      summary: { type: "string", description: "Short overall summary" },
    },
  },
  safetyConstraints: [
    { code: "detection_only", description: "Output is gap detection only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(detectMissingPagesCapability);

export type SearchTopicInput = {
  query: string;
  volume?: number | null;
};

export type ContentGraphNode = {
  path: string;
  title: string;
  keywords?: string[] | null;
  excerpt?: string | null;
};

export type DetectMissingPagesInput = {
  searchTopics: SearchTopicInput[] | string[];
  contentGraph: ContentGraphNode[];
  minCoverageScore?: number | null;
  maxGaps?: number | null;
  locale?: "nb" | "en" | null;
};

export type PageGap = {
  topic: string;
  reason: string;
  suggestedPath: string;
  suggestedTitle: string;
  priority: "low" | "medium" | "high";
  coverageScore?: number;
  bestExistingPath?: string;
};

export type DetectMissingPagesOutput = {
  gaps: PageGap[];
  summary: string;
};

function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[æå]/g, "a")
    .replace(/ø/g, "o")
    .replace(/[^a-z0-9-]/g, "");
}

function topicToTokens(topic: string): string[] {
  return topic
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/** Returns 0–1 coverage: how well content graph covers this topic. */
function coverageScore(
  topicTokens: string[],
  graph: ContentGraphNode[]
): { score: number; bestPath: string | undefined } {
  if (graph.length === 0) return { score: 0, bestPath: undefined };
  let bestScore = 0;
  let bestPath: string | undefined;
  for (const node of graph) {
    const titleLower = (node.title ?? "").toLowerCase();
    const keywords = (node.keywords ?? []).map((k) => String(k).toLowerCase());
    const excerptLower = (node.excerpt ?? "").toLowerCase();
    let hits = 0;
    for (const t of topicTokens) {
      if (titleLower.includes(t)) hits += 2;
      else if (keywords.some((k) => k.includes(t) || k === t)) hits += 1.5;
      else if (excerptLower.includes(t)) hits += 1;
    }
    const score = topicTokens.length > 0 ? Math.min(1, hits / topicTokens.length) : 0;
    if (score > bestScore) {
      bestScore = score;
      bestPath = (node.path ?? "").trim() || undefined;
    }
  }
  return { score: Math.round(bestScore * 100) / 100, bestPath };
}

function normalizeSearchTopics(
  input: SearchTopicInput[] | string[]
): Array<{ query: string; volume: number }> {
  if (!Array.isArray(input)) return [];
  return input.map((item) => {
    if (typeof item === "string") {
      return { query: item.trim(), volume: 1 };
    }
    const q = (item as SearchTopicInput).query;
    const v = (item as SearchTopicInput).volume;
    return {
      query: typeof q === "string" ? q.trim() : "",
      volume: typeof v === "number" && !Number.isNaN(v) ? Math.max(0, v) : 1,
    };
  }).filter((x) => x.query.length > 0);
}

/**
 * Detects missing pages by comparing search topics to the content graph.
 * Topics with coverage below threshold are returned as gaps with suggested path/title.
 * Deterministic; no external calls.
 */
export function detectMissingPages(input: DetectMissingPagesInput): DetectMissingPagesOutput {
  const isEn = input.locale === "en";
  const topics = normalizeSearchTopics(input.searchTopics ?? []);
  const graph = Array.isArray(input.contentGraph) ? input.contentGraph : [];
  const threshold = Math.max(0, Math.min(1, Number(input.minCoverageScore) ?? 0.3));
  const maxGaps = Math.min(50, Math.max(1, Math.floor(Number(input.maxGaps) ?? 20)));

  const gaps: PageGap[] = [];
  const seenTopics = new Set<string>();

  for (const { query, volume } of topics) {
    const key = query.toLowerCase().trim();
    if (seenTopics.has(key)) continue;
    seenTopics.add(key);

    const tokens = topicToTokens(query);
    if (tokens.length === 0) continue;

    const { score, bestPath } = coverageScore(tokens, graph);
    if (score >= threshold) continue;

    const suggestedSlug = slugify(query) || "page";
    const suggestedPath = `/${suggestedSlug}`;
    const suggestedTitle = query.trim() || (isEn ? "New page" : "Ny side");

    const priority: "low" | "medium" | "high" =
      score === 0 && volume >= 2 ? "high" : score === 0 ? "medium" : "low";

    const reason =
      score === 0
        ? isEn
          ? "No existing page clearly covers this search topic."
          : "Ingen eksisterende side dekker dette søkeemnet."
        : isEn
          ? `Weak coverage (${Math.round(score * 100)}%); consider a dedicated page.`
          : `Svak dekning (${Math.round(score * 100)}%); vurder en egen side.`;

    gaps.push({
      topic: query,
      reason,
      suggestedPath,
      suggestedTitle,
      priority,
      coverageScore: score,
      ...(bestPath ? { bestExistingPath: bestPath } : {}),
    });
  }

  gaps.sort((a, b) => {
    const p = (x: PageGap) => (x.priority === "high" ? 3 : x.priority === "medium" ? 2 : 1);
    if (p(b) !== p(a)) return p(b) - p(a);
    return (a.coverageScore ?? 0) - (b.coverageScore ?? 0);
  });

  const result = gaps.slice(0, maxGaps);
  const summary =
    result.length === 0
      ? isEn
        ? "No page gaps detected; search topics are covered."
        : "Ingen sidehull funnet; søkeemner er dekket."
      : isEn
        ? `${result.length} potential gap(s): topics with no or weak coverage.`
        : `${result.length} mulige hull: emner uten eller svak dekning.`;

  return { gaps: result, summary };
}

export { detectMissingPagesCapability, CAPABILITY_NAME };
