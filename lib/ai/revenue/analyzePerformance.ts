/**
 * STEP 3 — Performance engine: data-only weak-point detection (no LLM).
 * Requires minimum sample sizes — otherwise fail-closed (no blind changes).
 */

import type { CanonicalRevenueEvent } from "@/lib/analytics/events";
import { aggregateBlockAttribution } from "@/lib/analytics/attribution";
import type { ParsedDesignSettings } from "@/lib/cms/design/designContract";

export type PageBlockSummary = { id: string; type: string };

export type RevenueWeakPoint = {
  blockId?: string;
  issue: string;
  /** Human-readable proof (rates, counts). */
  evidence: string;
  /** Numeric hints for policy / logging */
  metrics?: Record<string, number>;
};

export type AnalyzePerformanceInput = {
  events: CanonicalRevenueEvent[];
  blocks: PageBlockSummary[];
  designSettings?: ParsedDesignSettings | null;
  /** Minimum page views to emit block-level findings */
  minPageViews?: number;
  /** Minimum attributed views per block */
  minBlockViews?: number;
};

export type AnalyzePerformanceOutput = {
  sampleOk: boolean;
  sampleReason?: string;
  pageViews: number;
  pageCta: number;
  pageConversions: number;
  pageCtr: number | null;
  avgPageScrollPct: number | null;
  weakPoints: RevenueWeakPoint[];
};

function avgScrollPage(events: CanonicalRevenueEvent[]): number | null {
  const depths = events
    .filter((e) => e.type === "scroll_depth" && e.scrollDepthPct != null)
    .map((e) => e.scrollDepthPct!);
  if (depths.length === 0) return null;
  return depths.reduce((a, b) => a + b, 0) / depths.length;
}

export function analyzePerformance(input: AnalyzePerformanceInput): AnalyzePerformanceOutput {
  const minPv = input.minPageViews ?? 40;
  const minBv = input.minBlockViews ?? 15;
  const events = Array.isArray(input.events) ? input.events : [];
  const { byBlock, pageTotals } = aggregateBlockAttribution(events);

  const pageViews = pageTotals.views;
  const pageCta = pageTotals.ctaClicks;
  const pageConv = pageTotals.conversions;
  const pageCtr = pageViews > 0 ? pageCta / pageViews : null;
  const avgPageScrollPct = avgScrollPage(events);

  if (pageViews < minPv) {
    return {
      sampleOk: false,
      sampleReason: `Trenger minst ${minPv} sidevisninger (har ${pageViews}). Ingen blinde anbefalinger.`,
      pageViews,
      pageCta,
      pageConversions: pageConv,
      pageCtr,
      avgPageScrollPct,
      weakPoints: [],
    };
  }

  const weakPoints: RevenueWeakPoint[] = [];

  if (avgPageScrollPct != null && avgPageScrollPct < 35) {
    weakPoints.push({
      issue: "low_scroll_depth",
      evidence: `Snitt scroll-dybde ${avgPageScrollPct.toFixed(1)}% < 35% — færre ser innhold lenger nede.`,
      metrics: { avgScrollPct: avgPageScrollPct },
    });
  }

  if (pageCtr != null && pageCtr < 0.012) {
    weakPoints.push({
      issue: "low_page_ctr",
      evidence: `Side-CTR ${(pageCtr * 100).toFixed(2)}% < 1,2% — få klikk per visning.`,
      metrics: { pageCtr },
    });
  }

  const blockTypeById = new Map(input.blocks.map((b) => [b.id, b.type]));
  for (const row of byBlock) {
    if (row.ctaClicks >= minBv && row.pageViews === 0) {
      weakPoints.push({
        blockId: row.blockId,
        issue: "cta_without_impression_events",
        evidence: `${row.ctaClicks} CTA-klikk uten page_view med cms_block_id — kan ikke beregne pålitelig CTR; legg inn visningssporing.`,
        metrics: { ctaClicks: row.ctaClicks },
      });
      continue;
    }
    if (row.pageViews < minBv) continue;
    const bType = blockTypeById.get(row.blockId);
    if (bType === "cta" && row.ctr != null && pageCtr != null && row.ctr < pageCtr * 0.55) {
      weakPoints.push({
        blockId: row.blockId,
        issue: "low_cta_ctr_vs_page",
        evidence: `CTR for blokk ${row.blockId} er ${(row.ctr * 100).toFixed(2)}% vs side ${(pageCtr * 100).toFixed(2)}%.`,
        metrics: { blockCtr: row.ctr, pageCtr },
      });
    }
    if ((bType === "cta" || bType === "form") && row.conversions === 0 && row.ctaClicks >= 25) {
      weakPoints.push({
        blockId: row.blockId,
        issue: "clicks_without_conversion",
        evidence: `${row.ctaClicks} klikk, 0 konverteringer attribuert til blokk ${row.blockId}.`,
        metrics: { ctaClicks: row.ctaClicks },
      });
    }
  }

  const spacing = input.designSettings?.spacing?.section;
  if (spacing === "tight" && avgPageScrollPct != null && avgPageScrollPct < 45) {
    weakPoints.push({
      issue: "dense_layout_may_limit_scroll",
      evidence: `Vertikal rytme er "tight" og scroll-snitt er ${avgPageScrollPct.toFixed(1)}%.`,
      metrics: { avgScrollPct: avgPageScrollPct },
    });
  }

  return {
    sampleOk: true,
    pageViews,
    pageCta,
    pageConversions: pageConv,
    pageCtr,
    avgPageScrollPct,
    weakPoints,
  };
}
