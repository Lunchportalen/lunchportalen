/**
 * Attribution: block → engagement → revenue (deterministic aggregation).
 * No guessing: rows without cms_block_id roll up to page-level only.
 */

import type { CanonicalRevenueEvent } from "./events";

export type BlockAttributionSummary = {
  blockId: string;
  page: string;
  pageViews: number;
  ctaClicks: number;
  formSubmits: number;
  conversions: number;
  scrollSamples: number;
  avgScrollDepthPct: number | null;
  revenueCents: number;
  /** clicks / max(views,1) when views attributed to block; else null */
  ctr: number | null;
  /** conversions / max(clicks,1) proxy when clicks > 0 */
  clickToConversionRate: number | null;
};

function safeDiv(a: number, b: number): number | null {
  if (b <= 0) return null;
  return a / b;
}

/**
 * Aggregate events that carry `blockId` into per-block stats.
 * Page-level views without block id are counted under "__page__" for page totals only.
 */
export function aggregateBlockAttribution(events: CanonicalRevenueEvent[]): {
  byBlock: BlockAttributionSummary[];
  pageTotals: { views: number; ctaClicks: number; conversions: number; revenueCents: number };
} {
  type Acc = {
    page: string;
    views: number;
    cta: number;
    forms: number;
    conv: number;
    scrollSum: number;
    scrollN: number;
    revenue: number;
  };
  const map = new Map<string, Acc>();
  let pageViewsAll = 0;
  let pageCtaAll = 0;
  let pageConvAll = 0;
  let pageRevAll = 0;

  for (const e of events) {
    if (e.type === "page_view") pageViewsAll += 1;
    if (e.type === "cta_click") pageCtaAll += 1;
    if (e.type === "conversion") {
      pageConvAll += 1;
      pageRevAll += e.revenueCents ?? 0;
    }

    const bid = e.blockId ?? "__page__";
    const key = `${e.page}::${bid}`;
    let a = map.get(key);
    if (!a) {
      a = { page: e.page, views: 0, cta: 0, forms: 0, conv: 0, scrollSum: 0, scrollN: 0, revenue: 0 };
      map.set(key, a);
    }
    switch (e.type) {
      case "page_view":
        a.views += 1;
        break;
      case "cta_click":
        a.cta += 1;
        break;
      case "form_submit":
        a.forms += 1;
        break;
      case "conversion":
        a.conv += 1;
        a.revenue += e.revenueCents ?? 0;
        break;
      case "scroll_depth":
        if (e.scrollDepthPct != null && e.scrollDepthPct >= 0) {
          a.scrollSum += e.scrollDepthPct;
          a.scrollN += 1;
        }
        break;
      default:
        break;
    }
  }

  const byBlock: BlockAttributionSummary[] = [];
  for (const [key, a] of map) {
    const blockId = key.split("::")[1] ?? "__page__";
    if (blockId === "__page__") continue;
    const avgScroll = a.scrollN > 0 ? a.scrollSum / a.scrollN : null;
    byBlock.push({
      blockId,
      page: a.page,
      pageViews: a.views,
      ctaClicks: a.cta,
      formSubmits: a.forms,
      conversions: a.conv,
      scrollSamples: a.scrollN,
      avgScrollDepthPct: avgScroll,
      revenueCents: a.revenue,
      ctr: safeDiv(a.cta, a.views),
      clickToConversionRate: safeDiv(a.conv, a.cta),
    });
  }

  byBlock.sort((x, y) => y.revenueCents - x.revenueCents || y.ctaClicks - x.ctaClicks);

  return {
    byBlock,
    pageTotals: {
      views: pageViewsAll,
      ctaClicks: pageCtaAll,
      conversions: pageConvAll,
      revenueCents: pageRevAll,
    },
  };
}
