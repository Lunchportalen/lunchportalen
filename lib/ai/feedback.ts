/**
 * Shared AI feedback utilities:
 * - Experiment / CMS feature extraction (server-safe pure functions)
 * - In-memory page insight + action log for the editor (client-safe)
 */

import type { ExperimentResults } from "@/lib/experiments/types";

// ─── Block feature extraction (used by adaptive scoring, CMS optimizer) ───

export type BlockFeatureSummary = {
  firstCtaIndex: number | null;
  heroPresent: boolean;
  trustHits: number;
  ctaCount: number;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function strLen(v: unknown): number {
  return typeof v === "string" ? v.trim().length : 0;
}

/** Flatten `{ type, data }` envelopes to a single record for reads. */
function normalizeBlockShape(b: unknown): Record<string, unknown> {
  if (!isPlainObject(b)) return {};
  const data = b.data;
  if (isPlainObject(data)) {
    return { ...b, ...data };
  }
  return b;
}

function blockTypeLoose(b: Record<string, unknown>): string {
  const t = b.type;
  return typeof t === "string" ? t.trim().toLowerCase() : "";
}

function heroHasCta(o: Record<string, unknown>): boolean {
  return Boolean(strLen(o.ctaLabel) && strLen(o.ctaHref));
}

/**
 * Deterministic structure signals from arbitrary CMS block JSON.
 */
export function blockFeatures(blocks: unknown[]): BlockFeatureSummary {
  const arr = Array.isArray(blocks) ? blocks : [];
  let firstCtaIndex: number | null = null;
  let heroPresent = false;
  let trustHits = 0;
  let ctaCount = 0;

  for (let i = 0; i < arr.length; i++) {
    const o = normalizeBlockShape(arr[i]);
    const t = blockTypeLoose(o);

    if (t === "hero") {
      heroPresent = true;
      if (heroHasCta(o)) {
        ctaCount += 1;
        if (firstCtaIndex === null) firstCtaIndex = i;
      }
    } else if (t === "cta") {
      ctaCount += 1;
      if (firstCtaIndex === null) firstCtaIndex = i;
    }

    if (t === "image" || t === "banners") {
      trustHits += 1;
    } else if (
      t.includes("testimonial") ||
      t.includes("quote") ||
      t.includes("logo") ||
      t.includes("trust")
    ) {
      trustHits += 1;
    }
  }

  return { firstCtaIndex, heroPresent, trustHits, ctaCount };
}

/**
 * Total length of primary copy-like fields (hero, rich text, CTA).
 */
export function primaryCopyPayloadLen(blocks: unknown[]): number {
  let n = 0;
  for (const raw of Array.isArray(blocks) ? blocks : []) {
    const o = normalizeBlockShape(raw);
    const t = blockTypeLoose(o);
    if (t === "hero") {
      n += strLen(o.title) + strLen(o.subtitle);
    } else if (t === "richtext" || t === "text") {
      n += strLen(o.body) + strLen(o.heading) + strLen(o.title);
    } else if (t === "cta") {
      n += strLen(o.title) + strLen(o.body);
    }
  }
  return n;
}

// ─── Experiment learning extraction ───

export type ExperimentLearningInput = {
  results: ExperimentResults;
  variantBlocks?: Record<string, unknown[]>;
  cmsSurface?: string;
};

export type LearningBasedOn = "experiment_data" | "seo_rules" | "cro_rules";

export type LearningSignalPayload = {
  patternKey: string;
  direction: "positive" | "negative";
  reason: string;
  basedOn: LearningBasedOn[];
  confidence: number;
};

export type LearningSignalsResult = {
  winningPatterns: LearningSignalPayload[];
  losingPatterns: LearningSignalPayload[];
  metricsSummary: {
    winnerVariantId: string | null;
    variantCount: number;
    totalViews: number;
    bestConversionRate: number;
    conversionSpread: number | null;
  };
};

function mergePatternMap(
  into: Map<string, LearningSignalPayload>,
  p: LearningSignalPayload,
): void {
  const prev = into.get(p.patternKey);
  if (!prev || p.confidence > prev.confidence) into.set(p.patternKey, p);
}

/**
 * Derives bounded, explainable pattern hints from experiment results + optional variant blocks.
 */
export function extractLearningSignals(input: ExperimentLearningInput): LearningSignalsResult {
  const variants = Array.isArray(input.results?.variants) ? input.results.variants : [];
  const winner = input.results?.winner ?? null;
  const vb = input.variantBlocks ?? {};

  const totalViews = variants.reduce((s, v) => s + (Number(v.views) || 0), 0);
  const variantCount = variants.length;
  const rates = variants.map((v) => Number(v.conversionRate) || 0);
  const bestConversionRate = winner?.conversionRate ?? (rates.length ? Math.max(...rates) : 0);
  const conversionSpread =
    rates.length >= 2 ? Math.max(...rates) - Math.min(...rates) : rates.length === 1 ? 0 : null;

  const winMap = new Map<string, LearningSignalPayload>();
  const loseMap = new Map<string, LearningSignalPayload>();

  if (!winner || variantCount < 2) {
    return {
      winningPatterns: [],
      losingPatterns: [],
      metricsSummary: {
        winnerVariantId: winner?.variantId ?? null,
        variantCount,
        totalViews,
        bestConversionRate,
        conversionSpread,
      },
    };
  }

  const wBlocks = vb[winner.variantId] ?? [];
  const wf = blockFeatures(wBlocks);
  const wLen = primaryCopyPayloadLen(wBlocks);
  const winRate = Number(winner.conversionRate) || 0;

  for (const v of variants) {
    if (v.variantId === winner.variantId) continue;
    const ob = vb[v.variantId] ?? [];
    const of = blockFeatures(ob);
    const oLen = primaryCopyPayloadLen(ob);
    const gap = winRate - (Number(v.conversionRate) || 0);
    const baseConf = Math.min(1, Math.max(0.15, gap * 8 + 0.15));

    if (wf.heroPresent && !of.heroPresent) {
      mergePatternMap(winMap, {
        patternKey: "structure:hero_present",
        direction: "positive",
        reason: "Vinnervariant hadde hero; annen variant manglet hero.",
        basedOn: ["experiment_data"],
        confidence: baseConf,
      });
    }
    if (wf.firstCtaIndex !== null && of.firstCtaIndex !== null && wf.firstCtaIndex < of.firstCtaIndex) {
      mergePatternMap(winMap, {
        patternKey: "structure:cta_earlier_in_page",
        direction: "positive",
        reason: "Vinnervariant hadde CTA tidligere i flyten.",
        basedOn: ["experiment_data", "cro_rules"],
        confidence: baseConf * 0.9,
      });
    }
    if (wf.trustHits >= 2 && of.trustHits < 2) {
      mergePatternMap(winMap, {
        patternKey: "structure:trust_signals_richer",
        direction: "positive",
        reason: "Vinnervariant hadde flere tillits-/innholdssignaler (bilder/bannere).",
        basedOn: ["experiment_data", "cro_rules"],
        confidence: baseConf * 0.85,
      });
    }
    if (wf.ctaCount >= 1 && wf.ctaCount <= 4 && (of.ctaCount === 0 || of.ctaCount > 6)) {
      mergePatternMap(winMap, {
        patternKey: "structure:balanced_cta_count",
        direction: "positive",
        reason: "Vinnervariant hadde mer balansert CTA-trykk.",
        basedOn: ["experiment_data", "cro_rules"],
        confidence: baseConf * 0.8,
      });
    }
    if (wLen > 0 && oLen > 0 && wLen + 40 < oLen && gap > 0) {
      mergePatternMap(winMap, {
        patternKey: "content:shorter_primary_copy",
        direction: "positive",
        reason: "Vinnervariant hadde kortere primærtekst med bedre konvertering.",
        basedOn: ["experiment_data", "cro_rules"],
        confidence: baseConf * 0.75,
      });
    }

    if (winRate > (Number(v.conversionRate) || 0) + 0.001 && gap > 0) {
      mergePatternMap(winMap, {
        patternKey: "metric:higher_conversion_winner",
        direction: "positive",
        reason: `Konverteringsrate ${(winRate * 100).toFixed(2)} % vs ${((Number(v.conversionRate) || 0) * 100).toFixed(2)} %.`,
        basedOn: ["experiment_data"],
        confidence: Math.min(1, baseConf),
      });
    }
  }

  return {
    winningPatterns: [...winMap.values()].slice(0, 12),
    losingPatterns: [...loseMap.values()].slice(0, 12),
    metricsSummary: {
      winnerVariantId: winner.variantId,
      variantCount,
      totalViews,
      bestConversionRate,
      conversionSpread,
    },
  };
}
