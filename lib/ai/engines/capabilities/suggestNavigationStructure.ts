/**
 * AI navigation optimizer capability: suggestNavigationStructure.
 * Evaluates cognitive load, click depth, and discoverability; returns suggested structure and recommendations.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "suggestNavigationStructure";

const suggestNavigationStructureCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Evaluates and suggests navigation structure. Assesses cognitive load (menu size and complexity), click depth (distance from home), and discoverability (ease of finding key pages). Returns evaluation scores and optional suggested structure.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Suggest navigation structure input",
    properties: {
      items: {
        type: "array",
        description: "Current top-level nav items (path, label, optional children)",
        items: {
          type: "object",
          properties: {
            path: { type: "string" },
            label: { type: "string" },
            children: {
              type: "array",
              description: "Optional nested items",
              items: { type: "object" },
            },
          },
        },
      },
      importantPaths: {
        type: "array",
        description: "Paths that should be highly discoverable (e.g. contact, pricing)",
        items: { type: "string" },
      },
      locale: { type: "string", description: "Locale (nb | en) for recommendation copy" },
    },
  },
  outputSchema: {
    type: "object",
    description: "Navigation evaluation and suggested structure",
    required: ["evaluation", "recommendations"],
    properties: {
      evaluation: {
        type: "object",
        required: ["cognitiveLoad", "clickDepth", "discoverability"],
        properties: {
          cognitiveLoad: {
            type: "object",
            required: ["level", "score", "summary"],
            properties: {
              level: { type: "string", description: "low | medium | high" },
              score: { type: "number", description: "0-100, higher = better (lower load)" },
              summary: { type: "string" },
              topLevelCount: { type: "number" },
              maxNestingDepth: { type: "number" },
            },
          },
          clickDepth: {
            type: "object",
            required: ["level", "score", "summary"],
            properties: {
              level: { type: "string", description: "low | medium | high" },
              score: { type: "number", description: "0-100, higher = better (shallower)" },
              summary: { type: "string" },
              maxDepth: { type: "number", description: "Max clicks from home to any leaf" },
              averageDepth: { type: "number" },
            },
          },
          discoverability: {
            type: "object",
            required: ["level", "score", "summary"],
            properties: {
              level: { type: "string", description: "low | medium | high" },
              score: { type: "number", description: "0-100, higher = better" },
              summary: { type: "string" },
              importantWithinTwoClicks: { type: "number", description: "Count of important paths within 2 clicks" },
              importantTotal: { type: "number" },
            },
          },
        },
      },
      recommendations: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "type", "message", "priority"],
          properties: {
            id: { type: "string" },
            type: { type: "string", description: "cognitive_load | click_depth | discoverability" },
            message: { type: "string" },
            priority: { type: "string", description: "low | medium | high" },
            suggestedAction: { type: "string" },
          },
        },
      },
      suggestedStructure: {
        type: "array",
        description: "Optional simplified/reordered nav items when improvements are recommended",
        items: {
          type: "object",
          properties: {
            path: { type: "string" },
            label: { type: "string" },
            order: { type: "number" },
            children: { type: "array", items: { type: "object" } },
          },
        },
      },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(suggestNavigationStructureCapability);

export type NavItemInput = {
  path?: string | null;
  label?: string | null;
  children?: NavItemInput[] | null;
};

export type SuggestNavigationStructureInput = {
  /** Current top-level navigation items. */
  items?: NavItemInput[] | null;
  /** Paths that should be easy to find (e.g. /kontakt, /priser). */
  importantPaths?: string[] | null;
  locale?: "nb" | "en" | null;
};

export type NavigationMetric = {
  level: "low" | "medium" | "high";
  score: number;
  summary: string;
};

export type CognitiveLoadEvaluation = NavigationMetric & {
  topLevelCount: number;
  maxNestingDepth: number;
};

export type ClickDepthEvaluation = NavigationMetric & {
  maxDepth: number;
  averageDepth: number;
};

export type DiscoverabilityEvaluation = NavigationMetric & {
  importantWithinTwoClicks: number;
  importantTotal: number;
};

export type NavigationEvaluation = {
  cognitiveLoad: CognitiveLoadEvaluation;
  clickDepth: ClickDepthEvaluation;
  discoverability: DiscoverabilityEvaluation;
};

export type NavigationRecommendation = {
  id: string;
  type: "cognitive_load" | "click_depth" | "discoverability";
  message: string;
  priority: "low" | "medium" | "high";
  suggestedAction?: string;
};

export type SuggestedNavItem = {
  path: string;
  label: string;
  order: number;
  children?: SuggestedNavItem[];
};

export type SuggestNavigationStructureOutput = {
  evaluation: NavigationEvaluation;
  recommendations: NavigationRecommendation[];
  suggestedStructure?: SuggestedNavItem[];
};

function countTopLevel(items: NavItemInput[] | null | undefined): number {
  if (!Array.isArray(items)) return 0;
  return items.length;
}

function computeNestingDepth(items: NavItemInput[] | null | undefined, depth: number): number {
  if (!Array.isArray(items) || items.length === 0) return depth;
  let max = depth;
  for (const item of items) {
    const child = Array.isArray(item.children) ? item.children : [];
    const childDepth = computeNestingDepth(child, depth + 1);
    if (childDepth > max) max = childDepth;
  }
  return max;
}

function collectPathsAndDepths(
  items: NavItemInput[] | null | undefined,
  depth: number,
  basePath: string
): Array<{ path: string; depth: number }> {
  const out: Array<{ path: string; depth: number }> = [];
  if (!Array.isArray(items)) return out;
  for (const item of items) {
    const path = (typeof item.path === "string" ? item.path.trim() : "") || basePath;
    out.push({ path: path || "/", depth });
    const child = Array.isArray(item.children) ? item.children : [];
    out.push(...collectPathsAndDepths(child, depth + 1, path));
  }
  return out;
}

function pathToDepthMap(items: NavItemInput[] | null | undefined): Map<string, number> {
  // Depth 1 = one click from home (top-level nav), 2 = two clicks, etc.
  const pairs = collectPathsAndDepths(items, 1, "/");
  const map = new Map<string, number>();
  for (const { path, depth } of pairs) {
    const normalized = path || "/";
    const existing = map.get(normalized);
    if (existing === undefined || depth < existing) map.set(normalized, depth);
  }
  return map;
}

function normalizePath(p: string): string {
  const s = (p ?? "").trim();
  return s || "/";
}

/**
 * Evaluates navigation and returns cognitive load, click depth, discoverability, recommendations, and optional suggested structure.
 * Deterministic; no external calls.
 */
export function suggestNavigationStructure(
  input: SuggestNavigationStructureInput
): SuggestNavigationStructureOutput {
  const isEn = input.locale === "en";
  const items = Array.isArray(input.items) ? input.items : [];
  const importantPaths = Array.isArray(input.importantPaths)
    ? input.importantPaths.map(normalizePath).filter((p) => p !== "/")
    : [];

  const topLevelCount = countTopLevel(items);
  const maxNestingDepth = computeNestingDepth(items, 0);
  const depthMap = pathToDepthMap(items);
  const depths = Array.from(depthMap.values());
  const maxDepth = depths.length ? Math.max(...depths) : 0;
  const averageDepth =
    depths.length > 0 ? Math.round((depths.reduce((a, b) => a + b, 0) / depths.length) * 10) / 10 : 0;

  // Cognitive load: 5–7 top-level items = ideal (high score), 1–4 = ok, 8–12 = medium, 13+ = high load (low score)
  const cognitiveScore =
    topLevelCount <= 7 ? 100 - (7 - topLevelCount) * 5 : Math.max(0, 65 - (topLevelCount - 7) * 5);
  const cognitiveLevel: "low" | "medium" | "high" =
    cognitiveScore >= 80 ? "low" : cognitiveScore >= 50 ? "medium" : "high";
  const nestingPenalty = maxNestingDepth > 2 ? Math.min(20, (maxNestingDepth - 2) * 10) : 0;
  const cognitiveLoad: CognitiveLoadEvaluation = {
    level: cognitiveLevel,
    score: Math.max(0, Math.min(100, Math.round(cognitiveScore - nestingPenalty))),
    summary: isEn
      ? `Top-level items: ${topLevelCount}, max nesting: ${maxNestingDepth}. ${cognitiveLevel === "low" ? "Load is manageable." : cognitiveLevel === "medium" ? "Consider reducing items or grouping." : "Simplify: fewer top-level items and less nesting."}`
      : `Toppnivå: ${topLevelCount}, maks nesting: ${maxNestingDepth}. ${cognitiveLevel === "low" ? "Belastning er håndterbar." : cognitiveLevel === "medium" ? "Vurder færre punkter eller gruppering." : "Forenkle: færre toppunkter og mindre nesting."}`,
    topLevelCount,
    maxNestingDepth,
  };

  // Click depth: 0–1 = excellent, 2 = good, 3+ = worse
  const depthScore = maxDepth <= 1 ? 100 : maxDepth === 2 ? 85 : Math.max(0, 70 - (maxDepth - 2) * 15);
  const clickLevel: "low" | "medium" | "high" =
    depthScore >= 80 ? "low" : depthScore >= 50 ? "medium" : "high";
  const clickDepth: ClickDepthEvaluation = {
    level: clickLevel,
    score: Math.round(depthScore),
    summary: isEn
      ? `Max depth: ${maxDepth} clicks, average: ${averageDepth}. ${clickLevel === "low" ? "Key content is shallow." : clickLevel === "medium" ? "Consider flattening some branches." : "Reduce depth so important pages are within 2 clicks."}`
      : `Maks dybde: ${maxDepth} klikk, gjennomsnitt: ${averageDepth}. ${clickLevel === "low" ? "Viktig innhold er grunt." : clickLevel === "medium" ? "Vurder å flate ut noen grener." : "Reduser dybde slik at viktige sider er innen 2 klikk."}`,
    maxDepth,
    averageDepth,
  };

  // Discoverability: share of important paths within 2 clicks
  const importantTotal = importantPaths.length || 1;
  const importantWithinTwoClicks = importantPaths.filter((p) => (depthMap.get(p) ?? 99) <= 2).length;
  const discoverScore = Math.round((importantWithinTwoClicks / importantTotal) * 100);
  const discoverLevel: "low" | "medium" | "high" =
    discoverScore >= 80 ? "high" : discoverScore >= 50 ? "medium" : "low";
  const discoverability: DiscoverabilityEvaluation = {
    level: discoverLevel,
    score: discoverScore,
    summary: isEn
      ? `${importantWithinTwoClicks}/${importantTotal} important paths within 2 clicks. ${discoverLevel === "high" ? "Good discoverability." : discoverLevel === "medium" ? "Move some important pages closer to home." : "Improve discoverability for key pages."}`
      : `${importantWithinTwoClicks}/${importantTotal} viktige stier innen 2 klikk. ${discoverLevel === "high" ? "God finnbarhet." : discoverLevel === "medium" ? "Flytt viktige sider nærmere hjem." : "Forbedre finnbarhet for nøkelsider."}`,
    importantWithinTwoClicks,
    importantTotal,
  };

  const recommendations: NavigationRecommendation[] = [];
  if (cognitiveLoad.score < 70) {
    recommendations.push({
      id: "nav-cognitive-reduce",
      type: "cognitive_load",
      message: cognitiveLoad.summary,
      priority: cognitiveLoad.score < 50 ? "high" : "medium",
      suggestedAction: isEn
        ? "Reduce top-level items to 5–7, or group into mega-menu categories."
        : "Reduser toppnivå til 5–7, eller grupper i megameny.",
    });
  }
  if (clickDepth.score < 70) {
    recommendations.push({
      id: "nav-depth-flatten",
      type: "click_depth",
      message: clickDepth.summary,
      priority: clickDepth.score < 50 ? "high" : "medium",
      suggestedAction: isEn
        ? "Flatten structure so key pages are reachable in 1–2 clicks from home."
        : "Flat ut strukturen slik at nøkelsider nås på 1–2 klikk fra hjem.",
    });
  }
  if (discoverability.score < 80 && importantTotal > 0) {
    recommendations.push({
      id: "nav-discover-promote",
      type: "discoverability",
      message: discoverability.summary,
      priority: discoverability.score < 50 ? "high" : "low",
      suggestedAction: isEn
        ? "Promote important paths to top-level or ensure they appear in primary nav."
        : "Fremhev viktige stier på toppnivå eller i primær meny.",
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      id: "nav-ok",
      type: "cognitive_load",
      message: isEn ? "Navigation structure is within recommended ranges." : "Navigasjonsstruktur er innenfor anbefalte rammer.",
      priority: "low",
    });
  }

  return {
    evaluation: { cognitiveLoad, clickDepth, discoverability },
    recommendations,
    suggestedStructure: undefined,
  };
}

export { suggestNavigationStructureCapability, CAPABILITY_NAME };
