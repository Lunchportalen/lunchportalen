// STATUS: KEEP

/**
 * Growth orchestrator — SEO + ads + funnel in one read-only bundle.
 * Does not publish, spend, or mutate live systems.
 */

import { generateAds, type AdsContext } from "./adsEngine";
import { buildFunnel, type FunnelAnalytics, type FunnelContent } from "./funnelEngine";
import { runSeoEngine, type SiteData } from "./seoEngine";

export type GrowthEngineInput = {
  siteData: SiteData;
  ads?: Partial<AdsContext> & { product?: string };
  funnelContent?: FunnelContent;
  funnelAnalytics?: FunnelAnalytics;
};

export type GrowthEngineResult = {
  seo: ReturnType<typeof runSeoEngine>;
  ads: ReturnType<typeof generateAds>;
  funnel: ReturnType<typeof buildFunnel>;
  recommendations: string[];
};

export function runGrowthEngine(input: GrowthEngineInput): GrowthEngineResult {
  const seo = runSeoEngine(input.siteData ?? {});

  const product =
    (input.ads?.product && String(input.ads.product).trim()) ||
    (input.siteData.domain ? `Tjeneste på ${input.siteData.domain}` : "Lunchportalen — bedriftslunsj og lunsjportal");

  const ads = generateAds({
    product,
    audience: input.ads?.audience,
    locale: input.ads?.locale,
    channels: input.ads?.channels,
  });

  const funnel = buildFunnel(input.funnelContent ?? {}, input.funnelAnalytics ?? {});

  const recommendations: string[] = [
    ...seo.opportunities.filter((o) => o.priority === "high").map((o) => o.message),
    ...funnel.improvements.slice(0, 4),
    "Annonsér kun etter at landing matcher H1 + CTA; ingen auto-oppretting av kampanjer i plattform.",
    "Mål eksperiment i eksisterende experiments-system før skalering av bud eller budsjett.",
  ];

  return { seo, ads, funnel, recommendations: Array.from(new Set(recommendations)) };
}
