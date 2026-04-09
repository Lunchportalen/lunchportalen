/**
 * STEP 1 — Pattern detection from {@link getSystemIntelligence} (one brain, no parallel silo).
 * Values align with {@link PublicSystemSignals}; confidence refined via {@link refineScaleConfidence}.
 */

import "server-only";

import { loadPatternWeights } from "@/lib/ai/learning";
import {
  emptyGtmLearning,
  learningTopIndustries,
  learningTopMessages,
  rebuildGtmLearningFromOutcomePayloads,
} from "@/lib/gtm/learning";

import { refineScaleConfidence } from "./confidence";
import { extractLearningHistory } from "./learning";
import { getEvents, type GetEventsFilter } from "./store";
import { deriveTrendsFromEvents } from "./trends";
import type { IntelligenceEvent, PublicSystemSignals, SystemIntelligence } from "./types";
import { bestChannelFromMessages, deriveSystemSignalsFromEvents, humanizeBestSpacing } from "./signals";

const SPACING_KEY = /spacing|section|padding|gap|rhythm|density|whitespace/i;

function clamp01(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function spacingScore(key: string): number {
  return SPACING_KEY.test(key) ? 2 : 1;
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

function rawConfidenceFromRateSample(rate: number, touches: number, runnerUpRate: number | null): number {
  const n = Math.max(0, touches);
  const sampleBoost = clamp01(n / 40);
  const gap = runnerUpRate != null ? Math.max(0, rate - runnerUpRate) : rate * 0.5;
  return clamp01(0.38 + rate * 0.42 + gap * 0.35 + sampleBoost * 0.12);
}

function rawSpacingConfidence(keyCounts: Map<string, number>, rawWinner: string): number {
  if (rawWinner === "insufficient_data" || keyCounts.size === 0) return 0;
  const total = [...keyCounts.values()].reduce((a, b) => a + b, 0);
  const winnerCount = keyCounts.get(rawWinner) ?? 0;
  if (total < 1) return 0;
  const share = winnerCount / total;
  const sorted = [...keyCounts.entries()].sort((a, b) => b[1] - a[1]);
  const second = sorted[1]?.[1] ?? 0;
  const margin = (winnerCount - second) / total;
  return clamp01(0.35 + share * 0.45 + margin * 0.25 + Math.min(total / 30, 0.12));
}

function countRevenueLikeEvents(events: readonly IntelligenceEvent[]): number {
  let n = 0;
  for (const e of events) {
    if (e.type !== "analytics") continue;
    const p = e.payload;
    if (p.kind === "revenue_insights" || (p.pageId != null && p.pageCtr != null)) n += 1;
  }
  return n;
}

function ctaEvidenceAndCtr(si: SystemIntelligence): { evidence: string[]; ctrValues: number[] } {
  const evidence: string[] = [];
  const ctrValues: number[] = [];
  for (const e of si.recentEvents) {
    if (e.type !== "analytics") continue;
    const p = e.payload;
    if (p.kind !== "revenue_insights" && p.pageId == null && p.pageCtr == null) continue;
    const ctr = typeof p.pageCtr === "number" && Number.isFinite(p.pageCtr) ? p.pageCtr : null;
    if (ctr != null) ctrValues.push(ctr);
    const focus = typeof p.ctaFocus === "string" ? p.ctaFocus.trim() : "";
    if (focus) evidence.push(`ctaFocus=${focus}`);
    if (ctr != null) evidence.push(`pageCtr=${(ctr * 100).toFixed(2)}%`);
  }
  if (si.signals.topCTA && si.signals.topCTA !== "insufficient_data") {
    evidence.unshift(`signal.topCTA=${si.signals.topCTA}`);
  }
  const topPat = si.meta?.topPatterns?.filter((x) => /cta|button|primary_action|conversion/i.test(x.key)).slice(0, 3);
  if (topPat?.length) {
    evidence.push(`meta.topPatterns=${topPat.map((x) => `${x.key}:${x.weight}`).join(",")}`);
  }
  return { evidence: [...new Set(evidence)].slice(0, 12), ctrValues };
}

function topTwoCtaPatternRates(si: SystemIntelligence): { winnerRate: number | undefined; runnerUp: number | null } {
  const ctaRows =
    si.meta?.topPatterns?.filter((x) => /cta|button|primary_action|conversion/i.test(x.key)) ?? [];
  if (ctaRows.length === 0) return { winnerRate: undefined, runnerUp: null };
  const maxW = Math.max(...ctaRows.map((x) => x.weight), 0);
  const sumW = ctaRows.reduce((a, x) => a + Math.max(0, x.weight), 0) || 1;
  const winnerRate = clamp01(maxW / sumW);
  const second = ctaRows
    .map((x) => x.weight)
    .sort((a, b) => b - a)[1];
  const runnerUp = second != null && sumW > 0 ? clamp01(second / sumW) : null;
  return { winnerRate, runnerUp };
}

export type DetectedPatternRow = {
  type: "cta" | "spacing" | "channel" | "industry";
  value: string;
  confidence: number;
  evidence: string[];
};

export type PatternDetectionOutput = {
  patterns: DetectedPatternRow[];
  generatedAt: string;
};

/**
 * Primary API — INPUT: result of {@link getSystemIntelligence} (same store, same signals).
 */
export function detectPatternsFromSystemIntelligence(si: SystemIntelligence): PatternDetectionOutput {
  const generatedAt = si.generatedAt;
  const events = si.recentEvents;
  const patterns: DetectedPatternRow[] = [];

  const gtm = si.meta?.gtmLearning ?? emptyGtmLearning();
  const topMessages = learningTopMessages(gtm, 8);
  const topIndustries = learningTopIndustries(gtm, 8);
  const channelTop = topMessages[0];
  const channelSecond = topMessages[1];
  const channelWinner = bestChannelFromMessages(topMessages);
  const channelEvidence: string[] = [];
  if (channelTop && channelTop.touches >= 1) {
    channelEvidence.push(
      `channel=${channelTop.key} positiveRate=${(channelTop.rate * 100).toFixed(1)}% touches=${channelTop.touches}`,
    );
  } else {
    channelEvidence.push("insufficient_gtm_channel_aggregate");
  }
  if (channelSecond && channelSecond.touches >= 1) {
    channelEvidence.push(`runnerUp=${channelSecond.key} rate=${(channelSecond.rate * 100).toFixed(1)}%`);
  }
  const channelRaw =
    channelTop && channelTop.touches >= 1
      ? rawConfidenceFromRateSample(channelTop.rate, channelTop.touches, channelSecond?.rate ?? null)
      : 0;
  const channelTouches = topMessages.reduce((a, r) => a + r.touches, 0);
  const channelConf = refineScaleConfidence({
    rawConfidence: channelRaw,
    relevantEventCount: channelTouches || countRevenueLikeEvents(events),
    winnerRate: channelTop?.rate,
    runnerUpRate: channelSecond?.rate ?? null,
    recentEvents: events,
    eventSupportsWinner: (e) => e.type === "gtm",
  });
  patterns.push({
    type: "channel",
    value: channelWinner,
    confidence: channelConf,
    evidence: channelEvidence,
  });

  const indTop = topIndustries[0];
  const indSecond = topIndustries[1];
  const industryWinner = indTop?.key ?? "insufficient_data";
  const industryEvidence: string[] = [];
  if (indTop && indTop.touches >= 1) {
    industryEvidence.push(
      `industry=${indTop.key} interestRate=${(indTop.rate * 100).toFixed(1)}% outreach=${indTop.touches}`,
    );
  } else {
    industryEvidence.push("insufficient_gtm_industry_aggregate");
  }
  const offerRows = Object.entries(gtm.offerStats ?? {}).map(([key, v]) => ({
    key,
    rate: v.attempts > 0 ? v.conversions / v.attempts : 0,
    attempts: v.attempts,
  }));
  offerRows.sort((a, b) => b.rate - a.rate || b.attempts - a.attempts);
  if (offerRows[0] && offerRows[0].attempts >= 2) {
    industryEvidence.push(
      `offer_close_proxy=${offerRows[0].key} rate=${(offerRows[0].rate * 100).toFixed(1)}% n=${offerRows[0].attempts}`,
    );
  }
  const industryRaw =
    indTop && indTop.touches >= 1
      ? rawConfidenceFromRateSample(indTop.rate, indTop.touches, indSecond?.rate ?? null)
      : 0;
  const industryTouches = topIndustries.reduce((a, r) => a + r.touches, 0);
  const industryConf = refineScaleConfidence({
    rawConfidence: industryRaw,
    relevantEventCount: industryTouches || 0,
    winnerRate: indTop?.rate,
    runnerUpRate: indSecond?.rate ?? null,
    recentEvents: events,
    eventSupportsWinner: (e) => e.type === "gtm",
  });
  patterns.push({
    type: "industry",
    value: si.signals.bestIndustry !== "insufficient_data" ? si.signals.bestIndustry : industryWinner,
    confidence: industryConf,
    evidence: industryEvidence,
  });

  const designKeys = collectDesignSuggestionKeys(events);
  const rawSpacing = pickBestSpacingRaw(designKeys);
  const spacingLabel = humanizeBestSpacing(rawSpacing);
  const spacingEvidence =
    rawSpacing === "insufficient_data"
      ? ["no_design_change_suggestionKeys"]
      : [
          `rawKey=${rawSpacing}`,
          `humanized=${spacingLabel}`,
          `uniqueKeys=${designKeys.size}`,
        ];
  const spacingRaw = rawSpacingConfidence(designKeys, rawSpacing);
  const designChangeCount = events.filter((e) => e.type === "design_change").length;
  const spacingConf = refineScaleConfidence({
    rawConfidence: spacingRaw,
    relevantEventCount: designChangeCount,
    recentEvents: events,
    eventSupportsWinner: (e) => e.type === "design_change",
  });
  patterns.push({
    type: "spacing",
    value: spacingLabel,
    confidence: spacingConf,
    evidence: spacingEvidence,
  });

  const { evidence: ctaEv, ctrValues } = ctaEvidenceAndCtr(si);
  const avgCtr = ctrValues.length ? ctrValues.reduce((a, b) => a + b, 0) / ctrValues.length : null;
  const { winnerRate: ctaPatWinner, runnerUp: ctaPatRunner } = topTwoCtaPatternRates(si);
  const ctaRawBase =
    avgCtr != null ? clamp01(0.42 + Math.min(avgCtr * 2.5, 0.48)) : ctaPatWinner != null ? clamp01(0.4 + ctaPatWinner * 0.45) : 0.35;
  const ctaConf = refineScaleConfidence({
    rawConfidence: ctaRawBase,
    relevantEventCount: countRevenueLikeEvents(events),
    winnerRate: avgCtr != null ? clamp01(avgCtr * 2) : ctaPatWinner ?? undefined,
    runnerUpRate: ctaPatRunner,
    recentEvents: events,
    eventSupportsWinner: (e) => {
      if (e.type !== "analytics") return false;
      const p = e.payload;
      return p.kind === "revenue_insights" || p.pageCtr != null || typeof p.ctaFocus === "string";
    },
  });
  patterns.push({
    type: "cta",
    value: si.signals.topCTA,
    confidence: ctaConf,
    evidence: ctaEv.length ? ctaEv : ["signal_only_cta"],
  });

  return { patterns, generatedAt };
}

// --- Legacy axis bundle (used by older callers; prefers full event fetch via store) ---

export type PatternAxisResult = {
  winner: string;
  confidence: number;
  explain: string[];
};

export type DetectedWinningPatterns = {
  generatedAt: string;
  signals: PublicSystemSignals;
  cta: PatternAxisResult;
  spacing: PatternAxisResult;
  channel: PatternAxisResult;
  industry: PatternAxisResult;
};

function isGtmLearningPayload(e: IntelligenceEvent): boolean {
  if (e.type !== "gtm") return false;
  const k = e.payload.kind;
  return k === "gtm_outcome" || k == null;
}

/**
 * Async path over raw store events — builds {@link SystemIntelligence}-compatible view then reuses SI detector.
 */
export async function detectWinningPatternsFromEvents(events: readonly IntelligenceEvent[]): Promise<DetectedWinningPatterns> {
  const signals = await deriveSystemSignalsFromEvents(events);
  const trends = deriveTrendsFromEvents(events, signals);
  const chrono = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const gtmPayloads = chrono.filter(isGtmLearningPayload).map((e) => e.payload);
  const gtmLearning = rebuildGtmLearningFromOutcomePayloads(gtmPayloads);
  const eventCounts: Record<string, number> = {};
  for (const e of events) {
    const t = e.type || "unknown";
    eventCounts[t] = (eventCounts[t] ?? 0) + 1;
  }
  const weights = await loadPatternWeights();
  const topPatterns = Object.entries(weights)
    .map(([key, weight]) => ({ key, weight: Number(weight) || 0 }))
    .filter((r) => r.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 16);

  const si: SystemIntelligence = {
    generatedAt: new Date().toISOString(),
    signals,
    recentEvents: events.slice(0, 200),
    trends,
    learningHistory: extractLearningHistory(events, 40),
    meta: { eventCounts, topPatterns, gtmLearning },
  };

  const { patterns } = detectPatternsFromSystemIntelligence(si);

  const toAxis = (p: DetectedPatternRow | undefined): PatternAxisResult => ({
    winner: p?.value ?? "insufficient_data",
    confidence: p?.confidence ?? 0,
    explain: p?.evidence ?? [],
  });

  return {
    generatedAt: si.generatedAt,
    signals,
    cta: toAxis(patterns.find((x) => x.type === "cta")),
    spacing: toAxis(patterns.find((x) => x.type === "spacing")),
    channel: toAxis(patterns.find((x) => x.type === "channel")),
    industry: toAxis(patterns.find((x) => x.type === "industry")),
  };
}

export type DetectWinningPatternsOpts = GetEventsFilter;

export async function detectWinningPatterns(opts?: DetectWinningPatternsOpts): Promise<DetectedWinningPatterns> {
  const events = await getEvents({ ...opts, limit: Math.max(opts?.limit ?? 800, 100) });
  return detectWinningPatternsFromEvents(events);
}
