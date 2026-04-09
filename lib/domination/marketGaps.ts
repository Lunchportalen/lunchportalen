/**
 * Markedsgap — deterministisk, forklarbar motor. **Ingen ML.**
 * Krever ekte signaler: tall/kuratering du legger inn i {@link OwnPerformanceSignals} og {@link Competitor}.
 * Hvert funn lister hvilke felt som utløste regelen (`signalsUsed`).
 */
import "server-only";

import type { Competitor } from "@/lib/domination/competitors";
import { scoreCompetitor } from "@/lib/domination/competitors";

/** Egne prestasjonssignaler (0–100 der annet ikke er angitt). Kun felt du faktisk har målt/kuratert. */
export type OwnPerformanceSignals = {
  /** 0–100 innholdskvalitet / redaksjonell SEO-styrke. */
  contentQualityScore?: number;
  /** 0–100 UX-/produktopplevelse (f.eks. fra intern vurdering eller målinger). */
  uxScore?: number;
  /** 0–1 engasjement (samme skala som vekst-dash: engagementScore). */
  engagementScore?: number;
  /** 0–100 pris-/marginmakt-indeks. */
  pricingPowerIndex?: number;
  /** 0–1 andel leveranser i rute. */
  onTimeDeliveryRate?: number;
  /** Snitt ledetid timer (lavere er bedre). */
  avgDeliveryLeadTimeHours?: number;
  /** Besøk/treff — sammenlignes med konkurrentenes estimerte trafikk der tilgjengelig. */
  traffic?: number;
  /** Konverteringsrate (0–1 typisk). */
  conversionRate?: number;
  /** Organisk SEO-trend (−1…1 el.l., negativt = svekkelse). */
  seoOrganicDelta?: number;
  /** Trinnvis frafall i funnel (0–1). */
  funnelDropRate?: number;
  /** Omsetnings-/inntektsproxy (indeks, sammenlignbar over tid). */
  revenueProxy?: number;
};

export type MarketGapImpact = "low" | "medium" | "high";

export type MarketGapFinding = {
  id: string;
  /** Kort, menneskelig beskrivelse av gapet. */
  gap: string;
  /** 0–1: hvor støttet funnet er av tilgjengelige signaler (flere kryssende signaler → høyere). */
  confidence: number;
  potentialImpact: MarketGapImpact;
  /** Hvilke konkrete felt/utregninger som utløste funnet (forklarbarhet). */
  signalsUsed: string[];
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function isNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function avgCompetitorScores(competitors: Competitor[]): { avg: number; details: string[] } {
  const list = Array.isArray(competitors) ? competitors : [];
  if (list.length === 0) return { avg: 0, details: ["Ingen konkurrenter i datasettet."] };
  const scores = list.map((c) => scoreCompetitor(c).score);
  const sum = scores.reduce((a, b) => a + b, 0);
  const avg = sum / scores.length;
  return {
    avg,
    details: [
      `Snitt konkurranse-score (scoreCompetitor): ${avg.toFixed(1)} over ${list.length} aktører.`,
      ...scores.map((s, i) => `  • ${list[i]!.name}: ${s}`),
    ],
  };
}

function medianTrafficEstimates(competitors: Competitor[]): number | null {
  const vals = competitors
    .map((c) => c.estimatedTraffic)
    .filter((t): t is number => isNum(t) && t >= 0)
    .sort((a, b) => a - b);
  if (vals.length === 0) return null;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[mid]! : (vals[mid - 1]! + vals[mid]!) / 2;
}

function premiumShare(competitors: Competitor[]): number {
  const list = Array.isArray(competitors) ? competitors : [];
  if (list.length === 0) return 0;
  const high = list.filter((c) => c.position === "high").length;
  return high / list.length;
}

/**
 * Finner markedsgap ut fra **dine** signaler og kuraterte konkurrentprofiler.
 * Returnerer kun funn der minst én regel er utløst med dokumenterbare signaler.
 */
export function detectMarketGaps(
  performance: OwnPerformanceSignals,
  competitors: Competitor[],
): MarketGapFinding[] {
  const p = performance ?? {};
  const comps = Array.isArray(competitors) ? competitors : [];
  const out: MarketGapFinding[] = [];

  const { avg: avgCompScore, details: compScoreDetails } = avgCompetitorScores(comps);
  const medTraffic = medianTrafficEstimates(comps);
  const premShare = premiumShare(comps);

  // --- Innhold / SEO ---
  if (isNum(p.contentQualityScore) && p.contentQualityScore < 55) {
    const conf = clamp01(0.45 + (55 - p.contentQualityScore) / 200);
    out.push({
      id: "weak_content_quality",
      gap: "Svak innholdskvalitet eller begrenset SEO-styrke",
      confidence: conf,
      potentialImpact: p.contentQualityScore < 40 ? "high" : "medium",
      signalsUsed: [
        `contentQualityScore=${p.contentQualityScore} (terskel <55).`,
        ...compScoreDetails.slice(0, 2),
      ],
    });
  }
  if (isNum(p.seoOrganicDelta) && p.seoOrganicDelta < -0.02) {
    const conf = clamp01(0.4 + Math.min(0.35, Math.abs(p.seoOrganicDelta) * 3));
    out.push({
      id: "seo_organic_headwind",
      gap: "Negativ organisk synlighet (SEO-trend)",
      confidence: conf,
      potentialImpact: p.seoOrganicDelta < -0.08 ? "high" : "medium",
      signalsUsed: [`seoOrganicDelta=${p.seoOrganicDelta} (terskel <-0.02).`],
    });
  }

  // --- UX / engasjement ---
  if (isNum(p.uxScore) && p.uxScore < 50) {
    out.push({
      id: "weak_ux",
      gap: "Svak brukeropplevelse (UX) relativt mål",
      confidence: clamp01(0.42 + (50 - p.uxScore) / 200),
      potentialImpact: p.uxScore < 35 ? "high" : "medium",
      signalsUsed: [`uxScore=${p.uxScore} (terskel <50).`],
    });
  }
  if (isNum(p.engagementScore) && p.engagementScore < 0.35) {
    out.push({
      id: "low_engagement",
      gap: "Lavt engasjement i produkt/funnel",
      confidence: clamp01(0.38 + (0.35 - p.engagementScore)),
      potentialImpact: p.engagementScore < 0.22 ? "high" : "medium",
      signalsUsed: [`engagementScore=${p.engagementScore} (terskel <0.35).`],
    });
  }
  if (isNum(p.funnelDropRate) && p.funnelDropRate > 0.45) {
    out.push({
      id: "funnel_friction",
      gap: "Høyt frafall i salgs- eller bestillingsfunnel",
      confidence: clamp01(0.4 + Math.min(0.3, (p.funnelDropRate - 0.45) * 2)),
      potentialImpact: p.funnelDropRate > 0.6 ? "high" : "medium",
      signalsUsed: [`funnelDropRate=${p.funnelDropRate} (terskel >0.45).`],
    });
  }

  // --- Pris / margin ---
  if (isNum(p.pricingPowerIndex) && p.pricingPowerIndex < 45) {
    const signals = [`pricingPowerIndex=${p.pricingPowerIndex} (terskel <45).`];
    let conf = clamp01(0.42 + (45 - p.pricingPowerIndex) / 150);
    if (comps.length > 0 && premShare >= 0.4) {
      signals.push(`Konkurrenter i «high»-posisjon: ${(premShare * 100).toFixed(0)} % av settet.`);
      conf = clamp01(conf + 0.12);
    }
    out.push({
      id: "low_pricing_power",
      gap: "Begrenset pris- eller marginmakt",
      confidence: conf,
      potentialImpact: p.pricingPowerIndex < 30 ? "high" : "medium",
      signalsUsed: signals,
    });
  }

  // --- Levering ---
  if (isNum(p.onTimeDeliveryRate) && p.onTimeDeliveryRate < 0.92) {
    out.push({
      id: "delivery_reliability",
      gap: "Leveringspålitelighet under mål",
      confidence: clamp01(0.45 + (0.92 - p.onTimeDeliveryRate)),
      potentialImpact: p.onTimeDeliveryRate < 0.85 ? "high" : "medium",
      signalsUsed: [`onTimeDeliveryRate=${p.onTimeDeliveryRate} (terskel <0.92).`],
    });
  }
  if (isNum(p.avgDeliveryLeadTimeHours) && p.avgDeliveryLeadTimeHours > 2.5) {
    out.push({
      id: "slow_delivery_leadtime",
      gap: "Lang ledetid på leveranse",
      confidence: clamp01(0.4 + Math.min(0.25, (p.avgDeliveryLeadTimeHours - 2.5) / 20)),
      potentialImpact: p.avgDeliveryLeadTimeHours > 4 ? "high" : "medium",
      signalsUsed: [`avgDeliveryLeadTimeHours=${p.avgDeliveryLeadTimeHours} (terskel >2.5t).`],
    });
  }

  // --- Relativ konkurranse (krever både egne tall og konkurrentliste) ---
  if (comps.length > 0 && isNum(p.traffic) && medTraffic != null && p.traffic < medTraffic * 0.7) {
    out.push({
      id: "reach_vs_competitors",
      gap: "Lavere estimert reach enn median konkurrent (trafikk)",
      confidence: clamp01(0.35 + Math.min(0.35, (medTraffic * 0.7 - p.traffic) / (medTraffic + 1))),
      potentialImpact: p.traffic < medTraffic * 0.5 ? "high" : "medium",
      signalsUsed: [
        `traffic=${p.traffic}, median konkurrent estimatedTraffic≈${medTraffic.toFixed(0)}.`,
        ...compScoreDetails.slice(0, 1),
      ],
    });
  }

  if (comps.length > 0 && isNum(p.pricingPowerIndex) && p.pricingPowerIndex < 55 && avgCompScore > 62) {
    out.push({
      id: "competitive_pressure_premium",
      gap: "Konkurransepress der motstandere scorer høyt og egen pris-/marginmakt er begrenset",
      confidence: clamp01(0.33 + (avgCompScore - 62) / 200 + (55 - p.pricingPowerIndex) / 200),
      potentialImpact: p.pricingPowerIndex < 40 && avgCompScore > 70 ? "high" : "medium",
      signalsUsed: [
        `pricingPowerIndex=${p.pricingPowerIndex}, snitt konkurranse-score=${avgCompScore.toFixed(1)}.`,
        ...compScoreDetails,
      ],
    });
  }

  // Deduplicate by id (keep strongest confidence)
  const byId = new Map<string, MarketGapFinding>();
  for (const g of out) {
    const prev = byId.get(g.id);
    if (!prev || g.confidence > prev.confidence) byId.set(g.id, g);
  }

  return [...byId.values()].sort((a, b) => {
    const rank: Record<MarketGapImpact, number> = { high: 3, medium: 2, low: 1 };
    if (rank[b.potentialImpact] !== rank[a.potentialImpact]) {
      return rank[b.potentialImpact] - rank[a.potentialImpact];
    }
    return b.confidence - a.confidence;
  });
}
