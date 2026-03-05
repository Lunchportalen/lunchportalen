/**
 * Page Health Engine V1 - Beyond Umbraco
 * Deterministic: score (never 100 on empty), issues, suggestions, recommendedStructure.
 */

export type Severity = "info" | "warn" | "error";

export type Issue = {
  id: string;
  severity: Severity;
  title: string;
  detail?: string;
  blockId?: string;
};

export type SuggestionAction =
  | { type: "addBlock"; blockType: string; insertAt?: "start" | "end"; insertAfterType?: string }
  | { type: "applyTemplate"; templateId: "recommendedBasic" };

export type Suggestion = {
  id: string;
  title: string;
  detail?: string;
  action: SuggestionAction;
  priority: number;
};

export type PageHealth = {
  score: number;
  issues: Issue[];
  suggestions: Suggestion[];
  recommendedStructure: string[];
};

const RECOMMENDED_STRUCTURE = ["Hero", "Intro text", "CTA"] as const;

const PENALTY = { error: 20, warn: 10, info: 4 } as const;
const BONUS_HERO = 6;
const BONUS_RICHTEXT = 4;
const BONUS_CTA = 3;

function makeId(prefix: string, n: number): string {
  return prefix + "_" + n;
}

function dedupeById<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter((x) => {
    if (seen.has(x.id)) return false;
    seen.add(x.id);
    return true;
  });
}

export function getPageHealth(args: {
  blocks: Array<{ id: string; type: string; [k: string]: unknown }>;
  context?: { isHome?: boolean; docType?: string | null };
}): PageHealth {
  const blocks = Array.isArray(args.blocks) ? args.blocks : [];
  const context = args.context ?? {};
  const issues: Issue[] = [];
  const suggestions: Suggestion[] = [];

  const isEmpty = blocks.length === 0;

  if (isEmpty) {
    issues.push({
      id: makeId("no_blocks", 0),
      severity: "error",
      title: "No content blocks",
      detail: "Add at least a Hero or Intro section.",
    });
    issues.push({
      id: makeId("missing_intro", 1),
      severity: "warn",
      title: "Missing intro",
      detail: "A page should start with an intro section.",
    });
    suggestions.push({
      id: makeId("sug_template", 0),
      title: "Apply recommended structure",
      detail: "Add Hero, Intro text and CTA in one go.",
      action: { type: "applyTemplate", templateId: "recommendedBasic" },
      priority: 100,
    });
    suggestions.push({
      id: makeId("sug_hero", 1),
      title: "Add Hero at start",
      detail: "Start with a hero section.",
      action: { type: "addBlock", blockType: "hero", insertAt: "start" },
      priority: 90,
    });
  } else {
    const firstTwo = blocks.slice(0, 2);
    const hasHeroEarly = firstTwo.some((b) => b.type === "hero");
    const hasRichTextEarly = firstTwo.some((b) => b.type === "richText");
    if (!hasHeroEarly && !hasRichTextEarly) {
      issues.push({
        id: makeId("missing_intro", issues.length),
        severity: "warn",
        title: "Missing intro",
        detail: "Consider adding a Hero or Rich text block near the top.",
      });
      suggestions.push({
        id: makeId("sug_hero_start", suggestions.length),
        title: "Add Hero at start",
        detail: "Start with a hero section.",
        action: { type: "addBlock", blockType: "hero", insertAt: "start" },
        priority: 90,
      });
    }

    const ctaCount = blocks.filter((b) => b.type === "cta").length;
    if (ctaCount > 2) {
      issues.push({
        id: makeId("too_many_cta", issues.length),
        severity: "info",
        title: "Too many CTAs",
        detail: "Consider reducing to 1-2.",
      });
    }

    blocks.forEach((b) => {
      if (b.type !== "cta") return;
      const d = (b.data ?? b) as Record<string, unknown>;
      const label = String(d?.buttonLabel ?? d?.label ?? "").trim();
      const href = String(d?.buttonHref ?? d?.href ?? "").trim();
      if (label.length === 0 || href.length === 0) {
        issues.push({
          id: makeId("empty_cta", issues.length),
          severity: "warn",
          title: "Empty CTA",
          detail: "CTA is missing label or link.",
          blockId: b.id,
        });
      }
    });

    blocks.forEach((b) => {
      if (b.type !== "banners") return;
      const items = (b.data ?? b) as Record<string, unknown>;
      const arr = Array.isArray(items?.items) ? items.items : [];
      if (arr.length < 2) {
        issues.push({
          id: makeId("banners_min", issues.length),
          severity: "warn",
          title: "Banners need at least 2 items",
          detail: "Add more items in the inspector.",
          blockId: b.id,
        });
      }
    });

    const last = blocks[blocks.length - 1];
    if (last && last.type !== "cta" && last.type !== "richText") {
      issues.push({
        id: makeId("no_closing", issues.length),
        severity: "info",
        title: "Missing closing section",
        detail: "Consider ending with a CTA or Rich text block.",
      });
      suggestions.push({
        id: makeId("sug_cta_end", suggestions.length),
        title: "Add CTA at end",
        detail: "Add a call-to-action at the end.",
        action: { type: "addBlock", blockType: "cta", insertAt: "end" },
        priority: 50,
      });
    }
  }

  const deduped = dedupeById(issues);
  let score = isEmpty ? 65 : 85;
  for (const i of deduped) {
    score -= PENALTY[i.severity];
  }
  if (!isEmpty) {
    if (blocks.some((b) => b.type === "hero")) score += BONUS_HERO;
    if (blocks.some((b) => b.type === "richText")) score += BONUS_RICHTEXT;
    if (blocks.some((b) => b.type === "cta")) score += BONUS_CTA;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  const sortedSuggestions = [...suggestions].sort((a, b) => b.priority - a.priority);

  return {
    score,
    issues: deduped,
    suggestions: sortedSuggestions,
    recommendedStructure: [...RECOMMENDED_STRUCTURE],
  };
}
