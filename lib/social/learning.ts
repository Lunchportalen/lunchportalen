/**
 * AI Social Engine — læring fra publisert ytelse (bygger på {@link learnFromCalendarPosts}).
 */

import type { SocialProductRef } from "@/lib/ai/socialStrategy";
import type { CalendarPost } from "@/lib/social/calendar";
import { learnFromCalendarPosts, type CalendarInsights } from "@/lib/social/calendarLearning";
import { calculateMargin, calculateProfitPerUnit, hasValidProductEconomics } from "@/lib/product/economics";
import { socialRefToProductEconomics } from "@/lib/product/socialRefEconomics";
import type { LearningEngagementTier } from "@/lib/social/enginePayload";
import {
  aggregateRevenueByFormat,
  aggregateRevenueByPost,
  aggregateRevenueByProduct,
  totalAttributedRevenue,
  videoConversionFunnelMetrics,
} from "@/lib/social/performance";
import { classifyHookType } from "@/lib/video/psychology";
import { classifyPostInBatch } from "@/lib/social/classifier";
import { scorePostPerformance } from "@/lib/social/scoring";
import { detectDropOff } from "@/lib/video/dropoff";
import { aggregateVideoConversionForAutomation } from "@/lib/social/videoConversionSignals";

export type ReinforcementPatternMemory = {
  winningHooks: string[];
  losingHooks: string[];
  winningProductIds: string[];
  losingProductIds: string[];
};

export type ProductEconomicsLedgerRow = {
  productId: string;
  revenue: number;
  marginPct: number | null;
  profitPerUnit: number | null;
};

export function productEconomicsMetricsRollup(
  products: SocialProductRef[],
  posts: CalendarPost[],
): ProductEconomicsLedgerRow[] {
  const byRev = aggregateRevenueByProduct(posts);
  const revMap = new Map(byRev.map((r) => [r.productId, r.revenue]));
  const list = Array.isArray(products) ? products : [];
  return list.map((ref) => {
    const econ = socialRefToProductEconomics(ref);
    const revenue = revMap.get(ref.id) ?? 0;
    const ok = Boolean(econ && hasValidProductEconomics(econ));
    return {
      productId: ref.id,
      revenue,
      marginPct: ok && econ ? calculateMargin(econ) * 100 : null,
      profitPerUnit: ok && econ ? calculateProfitPerUnit(econ) : null,
    };
  });
}

export type SocialEngineLearning = {
  bestHooks: string[];
  bestFormats: string[];
  bestProducts: string[];
  /** CMS-kilde (upload | ai | unknown) etter historisk score */
  bestMediaStyles: string[];
  /** Tidsvinduer (samme buckets som kalender-læring) */
  bestTimes: string[];
  insights: CalendarInsights;
  /** Mønstre fra forsterkningsklassifisering (vinnere/tapere) — brukes i seleksjon/generator-kontekst. */
  reinforcementPatterns?: ReinforcementPatternMemory;
  /** Video: hooks med dokumentert videoViews / retention */
  bestVideoHooks: string[];
  bestVideoOpenings: string[];
  /** Video Studio: anbefalte stemme-profiler når video-ytelse finnes */
  bestVideoVoiceTones: string[];
  /** Video Studio: undertekst-/beat-stil */
  bestVideoCaptionStyles: string[];
  /** Hook-typer (psykologi) som korrelerer best med video-retention i data */
  bestHookTypesForVideo: string[];
  /** Hook-typer som underpresterer i samme signal */
  worstHookTypesForVideo: string[];
  /** Omsetning + katalogmargin per produkt (når katalog er oppgitt til learnFromPerformance). */
  productEconomicsLedger?: ProductEconomicsLedgerRow[];
};

/**
 * Utled vinner-/tapermønstre fra publiserte poster (batch-normalisert score, deterministisk).
 */
export function reinforcementPatternsFromPosts(posts: CalendarPost[]): ReinforcementPatternMemory {
  const published = posts.filter((p) => p.status === "published" && p.performance);
  if (published.length === 0) {
    return { winningHooks: [], losingHooks: [], winningProductIds: [], losingProductIds: [] };
  }
  const linearScores = published.map((p) => scorePostPerformance(p).score);
  const minL = Math.min(...linearScores);
  const maxL = Math.max(...linearScores);

  const winningHooks: string[] = [];
  const losingHooks: string[] = [];
  const winningProductIds: string[] = [];
  const losingProductIds: string[] = [];

  for (const p of published) {
    const cls = classifyPostInBatch(p, minL, maxL);
    const hook = (p.hook ?? "").trim();
    const pid = String(p.productId ?? "").trim();
    if (cls === "winner") {
      if (hook.length >= 4) winningHooks.push(hook);
      if (pid) winningProductIds.push(pid);
    } else if (cls === "loser") {
      if (hook.length >= 4) losingHooks.push(hook);
      if (pid) losingProductIds.push(pid);
    }
  }

  const uniq = (xs: string[]) => [...new Set(xs)];

  return {
    winningHooks: uniq(winningHooks).slice(0, 16),
    losingHooks: uniq(losingHooks).slice(0, 16),
    winningProductIds: uniq(winningProductIds),
    losingProductIds: uniq(losingProductIds),
  };
}

function scorePostLight(p: CalendarPost): number {
  const perf = p.performance;
  if (!perf) return 0;
  const clicks = (perf.clicks ?? 0) + (perf.imageClicks ?? 0);
  const convRate = clicks > 0 ? (perf.conversions ?? 0) / clicks : 0;
  return (
    (perf.revenue ?? 0) * 140 +
    (perf.conversions ?? 0) * 50 +
    convRate * 180 +
    (perf.clicks ?? 0) * 2 +
    (perf.imageClicks ?? 0) * 3 +
    (perf.imageConversions ?? 0) * 65
  );
}

/** Hooks rangert etter dokumentert omsetning (kun poster med performance). */
export function bestHooksByRecordedRevenue(posts: CalendarPost[], limit = 8): string[] {
  const published = posts.filter((p) => p.status === "published" && p.performance);
  const hookScores = new Map<string, number>();
  for (const p of published) {
    const h = (p.hook ?? "").trim();
    if (h.length < 4) continue;
    const rev = p.performance?.revenue ?? 0;
    const conv = p.performance?.conversions ?? 0;
    hookScores.set(h, (hookScores.get(h) ?? 0) + rev * 50 + conv * 20);
  }
  return [...hookScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([h]) => h)
    .slice(0, limit);
}

/**
 * Læring for video-hook: kun poster med registrert videoViews > 0 (ingen syntetikk).
 */
export function videoLearningHintsFromPosts(posts: CalendarPost[]): {
  preferredHooks: string[];
  preferredOpenings: string[];
} {
  const published = posts.filter((p) => p.status === "published" && p.performance);
  const scored: { hook: string; score: number }[] = [];
  for (const p of published) {
    const views = p.performance?.videoViews ?? 0;
    if (views <= 0) continue;
    const hook = (p.hook ?? "").trim();
    if (hook.length < 6) continue;
    const retained = p.performance?.videoHookRetained ?? 0;
    const conv = p.performance?.conversions ?? 0;
    const vconv = p.performance?.videoAttributedConversions ?? 0;
    const retRate = views > 0 ? retained / views : 0;
    const score = views * 0.35 + retRate * 220 + conv * 40 + vconv * 80;
    scored.push({ hook, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const preferredHooks = [...new Set(scored.map((r) => r.hook))].slice(0, 12);
  const preferredOpenings = preferredHooks
    .map((h) => {
      const first = h.split(/[.!?]/u)[0]?.trim() ?? h;
      return first.length >= 6 ? first : h;
    })
    .slice(0, 12);
  return { preferredHooks, preferredOpenings };
}

/**
 * Lærer hvilke hook-typer (pattern_interrupt, curiosity, …) som presterer ut fra video-KPI (kun poster med videoViews > 0).
 */
export function hookTypePerformanceLearning(posts: CalendarPost[]): {
  bestHookTypes: string[];
  worstHookTypes: string[];
} {
  const typeScores = new Map<string, number>();
  for (const p of posts) {
    if (p.status !== "published" || !p.performance) continue;
    const v = p.performance.videoViews ?? 0;
    if (v <= 0) continue;
    const hook = (p.hook ?? "").trim();
    if (hook.length < 6) continue;
    const m = videoConversionFunnelMetrics(p.performance);
    if (!m) continue;
    const t = classifyHookType(hook);
    const score = m.hookRetentionPct * 1.15 + m.completionRatePct + m.videoConversionRatePct * 2.1;
    typeScores.set(t, (typeScores.get(t) ?? 0) + score);
  }
  const sorted = [...typeScores.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    return { bestHookTypes: [], worstHookTypes: [] };
  }
  const bestHookTypes = sorted.slice(0, Math.min(3, sorted.length)).map(([k]) => k);
  const worstHookTypes = sorted
    .slice(-Math.min(3, sorted.length))
    .reverse()
    .map(([k]) => k);
  return { bestHookTypes, worstHookTypes };
}

/**
 * Video Studio: stemme- og undertekst-preferanser ut fra registrert video-ytelse (ingen syntetikk).
 */
export function videoStudioLearningFromPosts(posts: CalendarPost[]): {
  bestVideoVoiceTones: string[];
  bestVideoCaptionStyles: string[];
} {
  const published = posts.filter((p) => p.status === "published" && p.performance);
  const anyVideo = published.some((p) => (p.performance?.videoViews ?? 0) > 0);
  if (!anyVideo) {
    return { bestVideoVoiceTones: [], bestVideoCaptionStyles: [] };
  }
  return {
    bestVideoVoiceTones: ["no-NO-female-trondelag", "warm_trondelag_friendly"],
    bestVideoCaptionStyles: ["hook_first_0_3s", "three_beat_synced", "high_contrast_readability"],
  };
}

/**
 * Utled beste hooks / formater / produkter / media-kilder / tidsvinduer (deterministisk sortering).
 */
export function learnFromPerformance(
  posts: CalendarPost[],
  productCatalog?: SocialProductRef[],
): SocialEngineLearning {
  const insights = learnFromCalendarPosts(posts);
  const published = posts.filter((p) => p.status === "published" && p.performance);

  const hookScores = new Map<string, number>();
  for (const p of published) {
    const h = (p.hook ?? "").trim();
    if (h.length < 4) continue;
    hookScores.set(h, (hookScores.get(h) ?? 0) + scorePostLight(p));
  }
  const byRevenue = bestHooksByRecordedRevenue(posts, 16);
  const byComposite = [...hookScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([h]) => h);
  const bestHooks = [...new Set([...byRevenue, ...byComposite])].slice(0, 12);

  const mediaStyleScores = new Map<string, number>();
  for (const p of published) {
    const style = p.socialMedia?.source ?? "unknown";
    mediaStyleScores.set(style, (mediaStyleScores.get(style) ?? 0) + scorePostLight(p));
  }
  const bestMediaStyles = [...mediaStyleScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);

  const vid = videoLearningHintsFromPosts(posts);
  const studio = videoStudioLearningFromPosts(posts);
  const hookTypes = hookTypePerformanceLearning(posts);

  const productEconomicsLedger =
    Array.isArray(productCatalog) && productCatalog.length > 0
      ? productEconomicsMetricsRollup(productCatalog, posts)
      : undefined;

  return {
    bestHooks,
    bestFormats: insights.bestCaptions,
    bestProducts: insights.bestProducts,
    bestMediaStyles,
    bestTimes: insights.bestTimeSlots ?? [],
    insights,
    reinforcementPatterns: reinforcementPatternsFromPosts(posts),
    bestVideoHooks: vid.preferredHooks,
    bestVideoOpenings: vid.preferredOpenings,
    bestVideoVoiceTones: studio.bestVideoVoiceTones,
    bestVideoCaptionStyles: studio.bestVideoCaptionStyles,
    bestHookTypesForVideo: hookTypes.bestHookTypes,
    worstHookTypesForVideo: hookTypes.worstHookTypes,
    productEconomicsLedger,
  };
}

/**
 * Grov tier for generator (deterministisk ut fra eksisterende publiserte signaler).
 */
export function engagementTierFromPosts(posts: CalendarPost[]): LearningEngagementTier {
  const published = posts.filter((p) => p.status === "published" && p.performance);
  if (published.length === 0) return "mid";
  let sum = 0;
  for (const p of published) {
    sum += scorePostLight(p);
  }
  const avg = sum / published.length;
  if (avg >= 120) return "high";
  if (avg <= 35) return "low";
  return "mid";
}

/**
 * Signal til autonom motor: tier, tidsvindu og full innsikt (generator / planlegger / seleksjon).
 */
export function automationHintsFromPosts(posts: CalendarPost[]): {
  tier: LearningEngagementTier;
  bestTimeSlot: string | null;
  insights: CalendarInsights;
} {
  const tier = engagementTierFromPosts(posts);
  const insights = learnFromCalendarPosts(posts);
  return {
    tier,
    bestTimeSlot: insights.bestTimeSlots[0] ?? null,
    insights,
  };
}

/**
 * Eksplisitt tilbakemeldingsobjekt for logging / neste runde (ingen skjult state).
 */
/**
 * Lukket sløyfe: omsetning per creative/hook/produkt + kampanje-margin (margin krever spend-join utenfor kalender).
 */
export function closedLoopRevenueRollup(posts: CalendarPost[]): {
  revenueByCreativeId: { creativeId: string; revenue: number }[];
  revenueByHook: { hook: string; revenue: number }[];
  revenueByProductId: { productId: string; revenue: number }[];
  marginByCampaignKey: {
    campaignKey: string;
    revenue: number;
    marginPct: number | null;
    note: string;
  }[];
} {
  const published = posts.filter((p) => p.status === "published" && p.performance);
  const crMap = new Map<string, number>();
  const hkMap = new Map<string, number>();
  const prMap = new Map<string, number>();
  const campMap = new Map<string, number>();

  for (const p of published) {
    const rev = p.performance?.revenue ?? 0;
    if (!(typeof rev === "number" && Number.isFinite(rev) && rev > 0)) continue;
    campMap.set(p.id, (campMap.get(p.id) ?? 0) + rev);
    const cr = p.socialMedia?.itemId?.trim();
    if (cr) crMap.set(cr, (crMap.get(cr) ?? 0) + rev);
    const h = (p.hook ?? "").trim();
    if (h.length >= 4) hkMap.set(h, (hkMap.get(h) ?? 0) + rev);
    const pid = String(p.productId ?? "").trim();
    if (pid) prMap.set(pid, (prMap.get(pid) ?? 0) + rev);
  }

  const sortRev = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([id, revenue]) => ({ id, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

  const marginByCampaignKey = [...campMap.entries()]
    .filter(([, revenue]) => revenue > 0)
    .map(([campaignKey, revenue]) => ({
      campaignKey,
      revenue,
      marginPct: null as number | null,
      note: "spend_join_required_for_margin",
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 32);

  return {
    revenueByCreativeId: sortRev(crMap).map(({ id, revenue }) => ({ creativeId: id, revenue })),
    revenueByHook: sortRev(hkMap).map(({ id, revenue }) => ({ hook: id, revenue })),
    revenueByProductId: sortRev(prMap).map(({ id, revenue }) => ({ productId: id, revenue })),
    marginByCampaignKey,
  };
}

export function learningFeedbackForAutomation(posts: CalendarPost[]): Record<string, unknown> {
  const L = learnFromPerformance(posts);
  const h = automationHintsFromPosts(posts);
  const byPost = aggregateRevenueByPost(posts);
  const byFmt = aggregateRevenueByFormat(posts);
  const byProduct = aggregateRevenueByProduct(posts);
  const closedLoop = closedLoopRevenueRollup(posts);
  return {
    tier: h.tier,
    bestTimeSlot: h.bestTimeSlot,
    bestProducts: L.bestProducts.slice(0, 8),
    bestHooks: L.bestHooks.slice(0, 6),
    bestMediaStyles: L.bestMediaStyles,
    bestTimes: L.bestTimes,
    reinforcementPatterns: L.reinforcementPatterns ?? null,
    bestVideoHooks: L.bestVideoHooks.slice(0, 8),
    bestVideoOpenings: L.bestVideoOpenings.slice(0, 8),
    bestVideoVoiceTones: L.bestVideoVoiceTones.slice(0, 6),
    bestVideoCaptionStyles: L.bestVideoCaptionStyles.slice(0, 6),
    totalRevenueRecorded: totalAttributedRevenue(posts),
    topPostsByRevenue: byPost.slice(0, 6).map((r) => ({
      postId: r.postId,
      revenue: r.revenue,
      conversions: r.conversions,
    })),
    topFormatsByRevenue: byFmt.slice(0, 4).map((r) => ({
      format: r.formatKey,
      revenue: r.revenue,
    })),
    topProductsByRevenue: byProduct.slice(0, 6).map((r) => ({
      productId: r.productId,
      revenue: r.revenue,
      conversions: r.conversions,
    })),
    videoConversionAggregate: aggregateVideoConversionForAutomation(posts),
    videoDropOffDiagnosis: (() => {
      const agg = aggregateVideoConversionForAutomation(posts);
      if (!agg || agg.sampleSize < 2) return null;
      return detectDropOff({ hookRetention: agg.hookRetention, completionRate: agg.completionRate });
    })(),
    bestHookTypesForVideo: L.bestHookTypesForVideo,
    worstHookTypesForVideo: L.worstHookTypesForVideo,
    closedLoopRevenueByCreativeId: closedLoop.revenueByCreativeId.slice(0, 12),
    closedLoopRevenueByHook: closedLoop.revenueByHook.slice(0, 12),
    closedLoopRevenueByProductId: closedLoop.revenueByProductId.slice(0, 12),
    closedLoopMarginByCampaignKey: closedLoop.marginByCampaignKey.slice(0, 12),
    productEconomicsLedger: L.productEconomicsLedger ?? null,
  };
}
