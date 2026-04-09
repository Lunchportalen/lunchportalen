/**
 * AI internal linking capability: generateInternalLinks.
 * Suggests internal links from page content and site graph (paths, titles, optional keywords).
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "generateInternalLinks";

const generateInternalLinksCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Suggests internal links for a page given its content and the site graph (other pages with path, title, optional keywords). Returns anchor text, target path, and optional reason.",
  requiredContext: ["pageContent", "siteGraph"],
  inputSchema: {
    type: "object",
    description: "Generate internal links input",
    properties: {
      pageContent: {
        type: "object",
        description: "Current page content",
        properties: {
          path: { type: "string", description: "Current page path (to exclude from targets)" },
          title: { type: "string", description: "Page title" },
          blocks: {
            type: "array",
            description: "Content blocks (heading, body, title text for matching)",
            items: { type: "object" },
          },
          plainText: { type: "string", description: "Optional concatenated text for matching" },
        },
      },
      siteGraph: {
        type: "array",
        description: "Site graph: other pages (path, title, optional keywords)",
        items: {
          type: "object",
          required: ["path", "title"],
          properties: {
            path: { type: "string" },
            title: { type: "string" },
            keywords: {
              type: "array",
              description: "Optional keywords for matching",
              items: { type: "string" },
            },
            excerpt: { type: "string", description: "Optional short description" },
          },
        },
      },
      maxSuggestions: { type: "number", description: "Max number of links to suggest (default 10)" },
      locale: { type: "string", description: "Locale (nb | en) for reason copy" },
    },
    required: ["pageContent", "siteGraph"],
  },
  outputSchema: {
    type: "object",
    description: "Suggested internal links",
    required: ["suggestedInternalLinks"],
    properties: {
      suggestedInternalLinks: {
        type: "array",
        items: {
          type: "object",
          required: ["anchorText", "toPath", "toTitle"],
          properties: {
            anchorText: { type: "string", description: "Suggested anchor text" },
            toPath: { type: "string", description: "Target page path" },
            toTitle: { type: "string", description: "Target page title" },
            blockId: { type: "string", description: "Optional block to insert link near" },
            reason: { type: "string", description: "Why this link is suggested" },
            priority: { type: "string", description: "low | medium | high" },
          },
        },
      },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is link suggestions only; no content mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateInternalLinksCapability);

export type PageContentInput = {
  path?: string | null;
  title?: string | null;
  blocks?: Array<{ heading?: string | null; body?: string | null; title?: string | null; id?: string | null }> | null;
  plainText?: string | null;
};

export type SiteGraphNode = {
  path: string;
  title: string;
  keywords?: string[] | null;
  excerpt?: string | null;
};

export type GenerateInternalLinksInput = {
  pageContent: PageContentInput;
  siteGraph: SiteGraphNode[];
  maxSuggestions?: number | null;
  locale?: "nb" | "en" | null;
};

export type SuggestedInternalLink = {
  anchorText: string;
  toPath: string;
  toTitle: string;
  blockId?: string;
  reason?: string;
  priority?: "low" | "medium" | "high";
};

export type GenerateInternalLinksOutput = {
  suggestedInternalLinks: SuggestedInternalLink[];
};

function normalizePath(p: string): string {
  return (p ?? "").trim() || "/";
}

function extractSearchableTokens(content: PageContentInput): string[] {
  const parts: string[] = [];
  const title = (content.title ?? "").trim();
  if (title) parts.push(title);
  const plain = (content.plainText ?? "").trim();
  if (plain) parts.push(plain);
  const blocks = Array.isArray(content.blocks) ? content.blocks : [];
  for (const b of blocks) {
    if (typeof b.heading === "string" && b.heading.trim()) parts.push(b.heading.trim());
    if (typeof b.body === "string" && b.body.trim()) parts.push(b.body.trim());
    if (typeof b.title === "string" && b.title.trim()) parts.push(b.title.trim());
  }
  const combined = parts.join(" ").toLowerCase();
  const words = combined.split(/\s+/).filter((w) => w.length > 1);
  return [...new Set(words)];
}

function scoreRelevance(
  tokens: string[],
  node: SiteGraphNode,
  currentPath: string
): { score: number; matchedBy: string } {
  const targetPath = normalizePath(node.path);
  if (targetPath === currentPath) return { score: 0, matchedBy: "" };
  const titleLower = (node.title ?? "").toLowerCase();
  const keywordSet = new Set(
    (node.keywords ?? []).filter((k) => typeof k === "string").map((k) => (k as string).toLowerCase())
  );
  const excerptLower = (node.excerpt ?? "").toLowerCase();
  let score = 0;
  let matchedBy = "";

  for (const t of tokens) {
    if (t.length < 2) continue;
    if (titleLower.includes(t)) {
      score += 3;
      if (!matchedBy) matchedBy = "title";
    }
    if (keywordSet.has(t) || (excerptLower && excerptLower.includes(t))) {
      score += 2;
      if (!matchedBy) matchedBy = "keyword";
    }
  }
  if (titleLower && tokens.some((t) => titleLower.includes(t) || titleLower.split(/\s+/).includes(t))) {
    if (!matchedBy) matchedBy = "title";
  }
  return { score, matchedBy };
}

/**
 * Generates suggested internal links from page content and site graph.
 * Ranks targets by relevance to content tokens (title, keywords, excerpt); excludes current page.
 * Deterministic; no external calls.
 */
export function generateInternalLinks(input: GenerateInternalLinksInput): GenerateInternalLinksOutput {
  const isEn = input.locale === "en";
  const content = input.pageContent ?? {};
  const currentPath = normalizePath(content.path ?? "");
  const graph = Array.isArray(input.siteGraph) ? input.siteGraph : [];
  const maxSuggestions = Math.min(20, Math.max(1, Math.floor(Number(input.maxSuggestions) ?? 10)));

  const tokens = extractSearchableTokens(content);
  const scored: Array<{ node: SiteGraphNode; score: number; matchedBy: string }> = [];

  for (const node of graph) {
    const path = normalizePath(node.path);
    if (path === currentPath) continue;
    const { score, matchedBy } = scoreRelevance(tokens, node, currentPath);
    if (score > 0) scored.push({ node, score, matchedBy });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, maxSuggestions);

  const reasonByMatch = (m: string): string =>
    m === "title"
      ? isEn ? "Relevant to page title/topic." : "Relevant for sidetittel/tema."
      : isEn ? "Matches content keywords." : "Matcher nøkkelord i innholdet.";

  const suggestedInternalLinks: SuggestedInternalLink[] = top.map(({ node, score, matchedBy }, i) => {
    const priority: "low" | "medium" | "high" = score >= 6 ? "high" : score >= 3 ? "medium" : "low";
    return {
      anchorText: node.title || node.path,
      toPath: normalizePath(node.path),
      toTitle: node.title || "",
      reason: reasonByMatch(matchedBy),
      priority,
    };
  });

  return { suggestedInternalLinks };
}

export { generateInternalLinksCapability, CAPABILITY_NAME };
