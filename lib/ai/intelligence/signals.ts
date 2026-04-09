/**
 * Signal engine — derives explainable signals from the unified {@link IntelligenceEvent} stream.
 */

import "server-only";

import { loadPatternWeights } from "@/lib/ai/learning";
import {
  learningTopIndustries,
  learningTopMessages,
  rebuildGtmLearningFromOutcomePayloads,
} from "@/lib/gtm/learning";

import { getEvents, type GetEventsFilter } from "./store";
import type { IntelligenceEvent, PublicSystemSignals } from "./types";

const SPACING_KEY = /spacing|section|padding|gap|rhythm|density|whitespace/i;

function spacingScore(key: string): number {
  return SPACING_KEY.test(key) ? 2 : 1;
}

function pickBestSpacingRaw(keyCounts: Map<string, number>): string {
  let best = "";
  let bestScore = 0;
  for (const [key, n] of keyCounts) {
    if (!key.trim()) continue;
    const s = n * spacingScore(key);
    if (s > bestScore || (s === bestScore && key < best)) {
      bestScore = s;
      best = key;
    }
  }
  return best || "insufficient_data";
}

/** Map raw design key to compact label (explainable heuristic). */
export function humanizeBestSpacing(rawKey: string): string {
  if (rawKey === "insufficient_data") return rawKey;
  const k = rawKey.toLowerCase();
  if (/wide|section|container|hero|loose|airy|open/i.test(k)) return "wide";
  if (/tight|compact|dense|narrow|minimal/i.test(k)) return "compact";
  return rawKey.length > 36 ? `${rawKey.slice(0, 33)}…` : rawKey;
}

function collectDesignSuggestionKeys(events: readonly IntelligenceEvent[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of events) {
    if (e.type !== "design_change") continue;
    const p = e.payload;
    const metrics = p.metrics;
    let keys: unknown = p.suggestionKeys;
    if (metrics && typeof metrics === "object" && !Array.isArray(metrics) && "suggestionKeys" in metrics) {
      keys = (metrics as Record<string, unknown>).suggestionKeys;
    }
    if (!Array.isArray(keys)) continue;
    for (const k of keys) {
      if (typeof k !== "string" || !k.trim()) continue;
      const t = k.trim();
      m.set(t, (m.get(t) ?? 0) + 1);
    }
  }
  return m;
}

function isGtmLearningPayload(e: IntelligenceEvent): boolean {
  if (e.type !== "gtm") return false;
  const k = e.payload.kind;
  return k === "gtm_outcome" || k == null;
}

function isRevenueInsightsPayload(e: IntelligenceEvent): boolean {
  if (e.type !== "analytics") return false;
  return e.payload.kind === "revenue_insights" || (e.payload.pageId != null && e.payload.pageCtr != null);
}

function latestRevenueCtaFocus(events: readonly IntelligenceEvent[]): string | null {
  for (const e of events) {
    if (!isRevenueInsightsPayload(e)) continue;
    const p = e.payload;
    if (typeof p.ctaFocus === "string" && p.ctaFocus.trim()) return p.ctaFocus.trim();
    if (typeof p.strongestCtaBlockId === "string" && p.strongestCtaBlockId.trim())
      return `cta_block:${p.strongestCtaBlockId.trim()}`;
  }
  return null;
}

function bestCtaFromPatterns(weights: Record<string, number>): string | null {
  let best: string | null = null;
  let w = 0;
  for (const [k, v] of Object.entries(weights)) {
    if (!/cta|button|primary_action|conversion/i.test(k)) continue;
    if (v > w) {
      w = v;
      best = k;
    }
  }
  return best;
}

export function bestChannelFromMessages(
  channels: Array<{ key: string; rate: number; touches: number }>,
): string {
  const top = channels[0];
  if (!top || top.touches < 1) return "insufficient_data";
  const prefix = top.key.split(":")[0]?.trim().toLowerCase();
  if (prefix === "linkedin" || prefix === "email") return prefix;
  return top.key.length > 48 ? `${top.key.slice(0, 45)}…` : top.key;
}

export type ComputeSystemSignalsOpts = GetEventsFilter;

/**
 * Derive signals from an in-memory event list (any order).
 */
export async function deriveSystemSignalsFromEvents(events: readonly IntelligenceEvent[]): Promise<PublicSystemSignals> {
  const chrono = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const gtmPayloads = chrono.filter(isGtmLearningPayload).map((e) => e.payload);
  const gtmLearning = rebuildGtmLearningFromOutcomePayloads(gtmPayloads);

  const topChannelRows = learningTopMessages(gtmLearning, 8);
  const topInd = learningTopIndustries(gtmLearning, 1);
  const bestIndustry = topInd[0]?.key ?? "insufficient_data";
  const bestChannel = bestChannelFromMessages(topChannelRows);

  const revFocus = latestRevenueCtaFocus(events);
  let topCTA = revFocus ?? "insufficient_data";
  if (topCTA === "insufficient_data") {
    const weights = await loadPatternWeights();
    const fromP = bestCtaFromPatterns(weights);
    if (fromP) topCTA = fromP;
  }

  const designKeys = collectDesignSuggestionKeys(events);
  const rawSpacing = pickBestSpacingRaw(designKeys);
  const bestSpacing = humanizeBestSpacing(rawSpacing);

  return {
    topCTA,
    bestSpacing,
    bestChannel,
    bestIndustry,
  };
}

/**
 * Load recent events from the store, then derive signals.
 */
export async function computeSystemSignals(opts?: ComputeSystemSignalsOpts): Promise<PublicSystemSignals> {
  const events = await getEvents({ ...opts, limit: Math.max(opts?.limit ?? 800, 100) });
  return deriveSystemSignalsFromEvents(events);
}
