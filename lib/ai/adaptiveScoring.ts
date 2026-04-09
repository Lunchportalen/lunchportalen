import "server-only";

import { blockFeatures, primaryCopyPayloadLen } from "@/lib/ai/feedback";
import { stripSurfacePrefixFromPatternKey } from "@/lib/ai/learningBySurface";
import type { CMSContentInput } from "@/lib/ai/types";

export type LearningBasedOn = "experiment_data" | "seo_rules" | "cro_rules";

export type ScoreAdjustment = {
  patternKey: string;
  delta: number;
  reason: string;
  basedOn: LearningBasedOn[];
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function collectBlocks(content: CMSContentInput): unknown[] {
  const raw = content.blocks;
  if (Array.isArray(raw)) return raw;
  const nested = content.data;
  if (isPlainObject(nested) && Array.isArray(nested.blocks)) return nested.blocks;
  return [];
}

/**
 * Map live page content to the same pattern keys produced by extractLearningSignals.
 */
export function contentPatternHits(content: CMSContentInput): Set<string> {
  const hits = new Set<string>();
  const blocks = collectBlocks(content);
  const f = blockFeatures(blocks);

  if (f.firstCtaIndex !== null && f.firstCtaIndex <= 2) hits.add("structure:cta_earlier_in_page");
  if (f.heroPresent) hits.add("structure:hero_present");
  if (f.trustHits >= 2) hits.add("structure:trust_signals_richer");
  if (f.ctaCount >= 1 && f.ctaCount <= 4) hits.add("structure:balanced_cta_count");

  return hits;
}

/**
 * Nudge base SEO/CRO blend using learned weights. Bounded, deterministic, explainable.
 */
export function adjustScore(
  baseScore: number,
  content: CMSContentInput,
  patternWeights: Record<string, number>,
): { adjustedScore: number; adjustments: ScoreAdjustment[] } {
  const hits = contentPatternHits(content);
  const adjustments: ScoreAdjustment[] = [];
  let sum = 0;
  const maxTotalDelta = 12;

  const explain = (key: string, w: number): { reason: string; basedOn: LearningBasedOn[] } => {
    switch (key) {
      case "structure:cta_earlier_in_page":
        return {
          reason: `Lært mønster «${key}»: tidlig CTA har historisk korrelert med bedre eksperimentutfall.`,
          basedOn: ["experiment_data", "cro_rules"],
        };
      case "structure:hero_present":
        return {
          reason: `Lært mønster «${key}»: hero tilstede har oftere fulgt vinnervarianter.`,
          basedOn: ["experiment_data", "cro_rules"],
        };
      case "structure:trust_signals_richer":
        return {
          reason: `Lært mønster «${key}»: rikere tillitssignaler har bidratt positivt i aggregerte resultater.`,
          basedOn: ["experiment_data", "cro_rules"],
        };
      case "structure:balanced_cta_count":
        return {
          reason: `Lært mønster «${key}»: moderat CTA-tetthet har stemt med vinnere i data.`,
          basedOn: ["experiment_data", "cro_rules"],
        };
      case "metric:higher_conversion_winner":
      case "metric:higher_ctr_winner":
        return {
          reason: `Aggregeret signal «${key}» fra trafikk — justerer score når innhold matcher strukturprofilen vi lærte.`,
          basedOn: ["experiment_data"],
        };
      case "content:shorter_primary_copy":
        return {
          reason: `Lært mønster «${key}»: kortere primærtekst/hero har korrelert med bedre eksperimentutfall.`,
          basedOn: ["experiment_data", "cro_rules"],
        };
      default:
        return {
          reason: `Lært mønster «${key}» (vekt ${w.toFixed(2)}).`,
          basedOn: ["experiment_data"],
        };
    }
  };

  for (const [key, w] of Object.entries(patternWeights)) {
    if (w === 0 || !Number.isFinite(w)) continue;
    const logicalKey = stripSurfacePrefixFromPatternKey(key);
    if (logicalKey.startsWith("metric:")) {
      const structural = hits.size > 0;
      if (!structural) continue;
      const scale = Math.min(1, hits.size / 4);
      const rawDelta = w * 0.8 * scale;
      const capped = Math.sign(rawDelta) * Math.min(Math.abs(rawDelta), 3);
      if (Math.abs(capped) < 0.05) continue;
      const { reason, basedOn } = explain(logicalKey, w);
      adjustments.push({ patternKey: key, delta: capped, reason, basedOn });
      sum += capped;
      continue;
    }

    if (!hits.has(logicalKey)) continue;
    const rawDelta = w * 1.2;
    const capped = Math.sign(rawDelta) * Math.min(Math.abs(rawDelta), 4);
    if (Math.abs(capped) < 0.05) continue;
    const { reason, basedOn } = explain(logicalKey, w);
    adjustments.push({ patternKey: key, delta: capped, reason, basedOn });
    sum += capped;
  }

  const total = Math.sign(sum) * Math.min(Math.abs(sum), maxTotalDelta);
  const scaleDown = Math.abs(sum) > maxTotalDelta && sum !== 0 ? total / sum : 1;
  const scaledAdjustments =
    scaleDown === 1 ? adjustments : adjustments.map((a) => ({ ...a, delta: Math.round(a.delta * scaleDown * 100) / 100 }));

  const adjustedScore = Math.max(0, Math.min(100, Math.round(baseScore + total)));
  return { adjustedScore, adjustments: scaledAdjustments };
}
