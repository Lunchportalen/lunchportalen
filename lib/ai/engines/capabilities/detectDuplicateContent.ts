/**
 * AI duplicate content detector capability: detectDuplicateContent.
 * Compares pages by title and content fingerprint to find exact or near-duplicate content.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "detectDuplicateContent";

const detectDuplicateContentCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Detects duplicate or near-duplicate content across pages. Uses page path, title, and content (excerpt/body) to find exact matches or high-similarity pairs. Returns pairs with reason and suggestion.",
  requiredContext: ["pages"],
  inputSchema: {
    type: "object",
    description: "Detect duplicate content input",
    properties: {
      pages: {
        type: "array",
        description: "Pages to compare (path, title, and content for fingerprinting)",
        items: {
          type: "object",
          required: ["path", "title"],
          properties: {
            path: { type: "string" },
            title: { type: "string" },
            excerpt: { type: "string", description: "Short text used for comparison" },
            body: { type: "string", description: "Full or truncated body for comparison" },
            contentHash: { type: "string", description: "Optional precomputed hash (if set, used for exact match)" },
          },
        },
      },
      minSimilarity: {
        type: "number",
        description: "Minimum similarity 0-1 to report as duplicate (default 0.85)",
      },
      maxPairs: { type: "number", description: "Max duplicate pairs to return (default 50)" },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["pages"],
  },
  outputSchema: {
    type: "object",
    description: "Detected duplicate content pairs",
    required: ["duplicates", "summary"],
    properties: {
      duplicates: {
        type: "array",
        items: {
          type: "object",
          required: ["pathA", "pathB", "reason", "similarity", "severity", "suggestion"],
          properties: {
            pathA: { type: "string" },
            pathB: { type: "string" },
            reason: { type: "string", description: "exact_match | high_similarity" },
            similarity: { type: "number", description: "0-1" },
            severity: { type: "string", description: "low | medium | high" },
            suggestion: { type: "string" },
            titleA: { type: "string" },
            titleB: { type: "string" },
          },
        },
      },
      summary: { type: "string", description: "Short overall summary" },
    },
  },
  safetyConstraints: [
    { code: "detection_only", description: "Output is detection only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(detectDuplicateContentCapability);

export type PageForDuplicateCheck = {
  path: string;
  title: string;
  excerpt?: string | null;
  body?: string | null;
  contentHash?: string | null;
};

export type DetectDuplicateContentInput = {
  pages: PageForDuplicateCheck[];
  minSimilarity?: number | null;
  maxPairs?: number | null;
  locale?: "nb" | "en" | null;
};

export type DuplicatePair = {
  pathA: string;
  pathB: string;
  reason: "exact_match" | "high_similarity";
  similarity: number;
  severity: "low" | "medium" | "high";
  suggestion: string;
  titleA?: string;
  titleB?: string;
};

export type DetectDuplicateContentOutput = {
  duplicates: DuplicatePair[];
  summary: string;
};

function normalizePath(p: string): string {
  return (p ?? "").trim() || "/";
}

function fingerprint(page: PageForDuplicateCheck): string {
  const hash = (page.contentHash ?? "").trim();
  if (hash) return hash;
  const title = (page.title ?? "").trim();
  const excerpt = (page.excerpt ?? "").trim();
  const body = (page.body ?? "").trim();
  const text = [title, excerpt, body].filter(Boolean).join("\n");
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(text: string): Set<string> {
  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  const words = normalized.split(/\s+/).filter((w) => w.length > 1);
  return new Set(words);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) {
    if (b.has(x)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Detects duplicate or near-duplicate content across the given pages.
 * Exact match: identical normalized fingerprint or contentHash.
 * High similarity: Jaccard similarity of word sets above threshold.
 * Deterministic; no external calls.
 */
export function detectDuplicateContent(input: DetectDuplicateContentInput): DetectDuplicateContentOutput {
  const isEn = input.locale === "en";
  const pages = Array.isArray(input.pages) ? input.pages : [];
  const minSim = Math.max(0, Math.min(1, Number(input.minSimilarity) ?? 0.85));
  const maxPairs = Math.min(100, Math.max(1, Math.floor(Number(input.maxPairs) ?? 50)));

  const normalized = pages.map((p) => ({
    path: normalizePath(p.path),
    title: (p.title ?? "").trim(),
    fingerprint: fingerprint(p),
    tokenSet: tokenSet([(p.title ?? "").trim(), (p.excerpt ?? "").trim(), (p.body ?? "").trim()].join(" ")),
  }));

  const seen = new Set<string>();
  const duplicates: DuplicatePair[] = [];

  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const a = normalized[i];
      const b = normalized[j];
      if (a.path === b.path) continue;

      const pairKey = [a.path, b.path].sort().join("|");
      if (seen.has(pairKey)) continue;

      let similarity = 0;
      let reason: "exact_match" | "high_similarity" = "high_similarity";

      if (a.fingerprint.length > 0 && a.fingerprint === b.fingerprint) {
        similarity = 1;
        reason = "exact_match";
      } else {
        similarity = jaccardSimilarity(a.tokenSet, b.tokenSet);
        if (similarity < minSim) continue;
        reason = similarity >= 0.98 ? "exact_match" : "high_similarity";
      }

      seen.add(pairKey);
      const severity: "low" | "medium" | "high" =
        reason === "exact_match" ? "high" : similarity >= 0.95 ? "medium" : "low";
      const suggestion =
        reason === "exact_match"
          ? isEn
            ? "Consider merging or redirecting one page to avoid duplicate content."
            : "Vurder å slå sammen eller redirecte én side for å unngå duplikat innhold."
          : isEn
            ? "Consider differentiating content or consolidating into one page."
            : "Vurder å differensiere innholdet eller slå sammen til én side.";

      duplicates.push({
        pathA: a.path,
        pathB: b.path,
        reason,
        similarity: Math.round(similarity * 100) / 100,
        severity,
        suggestion,
        titleA: a.title || undefined,
        titleB: b.title || undefined,
      });
    }
  }

  duplicates.sort((x, y) => y.similarity - x.similarity);
  const result = duplicates.slice(0, maxPairs);

  const summary =
    result.length === 0
      ? isEn
        ? "No duplicate content detected."
        : "Ingen duplikat innhold funnet."
      : isEn
        ? `${result.length} duplicate or near-duplicate pair(s) detected.`
        : `${result.length} duplikat- eller nær-duplikatpar funnet.`;

  return { duplicates: result, summary };
}

export { detectDuplicateContentCapability, CAPABILITY_NAME };
