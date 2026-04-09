/**
 * Strategimotor — anbefalinger uten sideeffekter, sortert etter impact.
 */

import type { StrategicContext } from "@/lib/ai/strategicContext";
import type { Opportunity } from "@/lib/ai/opportunities";
import type { PageSummary } from "@/lib/ai/siteAnalysis";
import type { MarketSignalResult } from "@/lib/ai/marketSignals";
import type { SimulationScenario } from "@/lib/ai/simulator";

export type StrategyArea = "seo" | "cro" | "pricing" | "content" | "social";

export type StrategyRecommendation = {
  id: string;
  title: string;
  description: string;
  /** Hvorfor AI CEO foreslår dette */
  why: string;
  /** Forventet effekt i plain language */
  whatHappens: string;
  /** Risiko ved utførelse */
  risk: "low" | "medium" | "high";
  impact: "high" | "medium" | "low";
  area: StrategyArea;
  simulationType: SimulationScenario;
  /** Antall sider anbefalingen typisk berører (estimat) */
  affectedPages: number;
};

const IMPACT_ORDER: Record<StrategyRecommendation["impact"], number> = { high: 0, medium: 1, low: 2 };

/** Prioritet: CRO → SoMe (reach) → SEO → pris → innhold */
const AREA_ORDER: Record<StrategyArea, number> = {
  cro: 0,
  social: 1,
  seo: 2,
  pricing: 3,
  content: 4,
};

function sortRecommendations(recs: StrategyRecommendation[]): StrategyRecommendation[] {
  return [...recs].sort((a, b) => {
    const da = AREA_ORDER[a.area] - AREA_ORDER[b.area];
    if (da !== 0) return da;
    const di = IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact];
    if (di !== 0) return di;
    return a.title.localeCompare(b.title, "nb");
  });
}

export type StrategyEngineInput = {
  pages?: PageSummary[];
  opportunities?: Opportunity[];
  market?: MarketSignalResult | null;
  /** Valgfritt: antall produkter tilgjengelig for SoMe-flyt */
  socialContext?: {
    productCount: number;
    /** Dager siden siste publiserte post (valgfri heuristikk) */
    daysSinceLastPost?: number;
  } | null;
};

export function generateStrategy(input: StrategyEngineInput): StrategyRecommendation[] {
  const recommendations: StrategyRecommendation[] = [];
  const pages = Array.isArray(input.pages) ? input.pages : [];
  const opps = Array.isArray(input.opportunities) ? input.opportunities : [];
  const oppCount = opps.length;
  const missingCtaPages = pages.filter((p) => !p.hasCTA).length;
  const lowScorePages = pages.filter((p) => p.score < 60).length;
  const thinPages = pages.filter((p) => p.wordCount < 120).length;
  const productCount = Math.max(0, Math.floor(Number(input.socialContext?.productCount) || 0));
  const daysSince = input.socialContext?.daysSinceLastPost;

  if (productCount > 0) {
    recommendations.push({
      id: "strat-social-instagram",
      title: "Øk synlighet på Instagram",
      description: "Produkter kan pushes jevnere for reach som driver trafikk inn mot nettside og konvertering.",
      why: `${productCount} produkt(er) tilgjengelig — jevn rytme gir ofte bedre algoritmerekkevidde enn sporadiske innlegg.`,
      whatHappens: "Planlegg 2–3 korte produktinnlegg per uke med tydelig CTA og merkekonsekvent visuelt uttrykk.",
      risk: "low",
      impact: "high",
      area: "social",
      simulationType: "social_post",
      affectedPages: 0,
    });
  } else {
    recommendations.push({
      id: "strat-social-cadence",
      title: "Bygg SoMe-kalender med produktdata",
      description: "Uten katalog koblet til forslag begrenses automatisering — start med manuell plan eller integrasjon.",
      why: "Distribusjon krever innholdskilde; vi antar ikke skjulte produkter.",
      whatHappens: "Når produkter er tilgjengelige, kan systemet foreslå trygge poster med forhåndsvisning og godkjenning.",
      risk: "low",
      impact: "medium",
      area: "social",
      simulationType: "social_post",
      affectedPages: 0,
    });
  }

  if (typeof daysSince === "number" && daysSince > 14 && productCount > 0) {
    recommendations.push({
      id: "strat-social-stale",
      title: "Gjenoppta jevnlige poster",
      description: "Det er lenge siden siste post — synlighet kan falle i kanalen.",
      why: `Ca. ${daysSince} dager siden siste registrerte post (manuelt signal).`,
      whatHappens: "Én godkjent produktpost kan raskt gjenopprette tilstedeværelse uten stor kampanje.",
      risk: "low",
      impact: "medium",
      area: "social",
      simulationType: "social_post",
      affectedPages: 0,
    });
  }

  if (pages.length === 1) {
    const p = pages[0];
    if (p && !p.hasCTA) {
      recommendations.push({
        id: "strat-single-cta",
        title: "Legg inn tydelig CTA på denne siden",
        description: "Siden mangler dedikert handlingsblokk eller hero-knapp.",
        why: "Uten synlig neste steg lekker konvertering selv med god trafikk.",
        whatHappens: "Én tydelig CTA øker ofte måloppnåelse før større kampanjer.",
        risk: "low",
        impact: "high",
        area: "cro",
        simulationType: "add_cta",
        affectedPages: 1,
      });
    }
    if (p && p.score < 60) {
      recommendations.push({
        id: "strat-single-seo",
        title: "Løft sidekvalitet og synlighet",
        description: "Poengsum under 60 — styrk tittel, meta og innhold.",
        why: `Lokal score er ${p.score}/100; flere forbedringspunkter sannsynlig.`,
        whatHappens: "Bedre relevans og klikkrate i søk; kombiner med CRO for uttak.",
        risk: "medium",
        impact: "medium",
        area: "seo",
        simulationType: "improve_seo",
        affectedPages: 1,
      });
    }
  }

  if (oppCount > 10 || missingCtaPages >= 5) {
    recommendations.push({
      id: "strat-cro-breadth",
      title: "Prioriter CRO på tvers",
      description: "Mange sider mangler tydelig handlingslinje — ofte raskere gevinst enn ren trafikkvekst.",
      why: `${oppCount} muligheter registrert; ${missingCtaPages} sider uten effektiv CTA.`,
      whatHappens: "Bedre knapper, hero-handling og tydelig neste steg øker ofte konvertering før ny trafikk trengs.",
      risk: "low",
      impact: "high",
      area: "cro",
      simulationType: "add_cta",
      affectedPages: Math.max(missingCtaPages, 1),
    });
  }

  if (lowScorePages >= 3 || pages.some((p) => p.score < 50)) {
    recommendations.push({
      id: "strat-seo-quality",
      title: "Hev kvalitetsscore og meta-grunnmur",
      description: "Flere sider under 60 poeng — styrk titler, meta og innholdsdybde.",
      why: `${lowScorePages} sider under 60 i lokal score-modell.`,
      whatHappens: "Bedre SERP-relevans og klikkrate over tid; kombineres med CTA for å ta ut trafikk.",
      risk: "medium",
      impact: oppCount > 5 ? "high" : "medium",
      area: "seo",
      simulationType: "improve_seo",
      affectedPages: Math.max(lowScorePages, 1),
    });
  }

  if (thinPages >= 2) {
    recommendations.push({
      id: "strat-content-depth",
      title: "Utvid innhold der volumet er tynt",
      description: "Korte sider gir svakere tillit og færre søkeord-treff.",
      why: `${thinPages} sider med lite tekst (under ~120 ord).`,
      whatHappens: "Mer konkret verdi-proposisjon og FAQ/seksjoner støtter både SEO og konvertering.",
      risk: "low",
      impact: "medium",
      area: "content",
      simulationType: "improve_content",
      affectedPages: Math.max(thinPages, 1),
    });
  }

  if (input.market?.label === "high_traffic_low_conversion") {
    recommendations.push({
      id: "strat-market-htlc",
      title: "Fang volumet med konverteringsfokus",
      description: "Trafikken er der — flytt fokus fra nye besøk til klar handling og tillit.",
      why: input.market.detail,
      whatHappens: "Prioriter A/B på CTA, hero og pris/kommunikasjon før nye kanalkostnader.",
      risk: "medium",
      impact: "high",
      area: "cro",
      simulationType: "add_cta",
      affectedPages: Math.max(pages.length, 1),
    });
  }

  if (input.market?.label === "low_visibility") {
    recommendations.push({
      id: "strat-market-vis",
      title: "Bygg synlighet før prisdiskusjon",
      description: "Lavt trafikkvolum gir usikkert grunnlag for aggressive prisgrep.",
      why: input.market.detail,
      whatHappens: "SEO, partnerskap og innholdsprogram øker datagrunnlaget for senere prising.",
      risk: "low",
      impact: "medium",
      area: "seo",
      simulationType: "improve_seo",
      affectedPages: Math.max(pages.length, 1),
    });
  }

  recommendations.push({
    id: "strat-pricing-governance",
    title: "Styr prisbeslutninger eksplisitt",
    description: "Bruk prisforslag kun som innspill — krev menneskelig godkjenning og dokumentasjon.",
    why: "Ingen skjulte prisendringer: kontrollert, revisjonsvennlig og i tråd med B2B-integritet.",
    whatHappens: "Teamet diskuterer forslag, velger variant, kommuniserer til kunder og logger beslutning.",
    risk: "high",
    impact: "medium",
    area: "pricing",
    simulationType: "pricing_tune",
    affectedPages: 0,
  });

  return sortRecommendations(recommendations);
}

/** Veivisere for roadmap (cron / strategi — deterministisk rekkefølge). */
export type StrategyPillar =
  | "RETENTION_FIRST"
  | "CONVERSION_OPTIMIZATION"
  | "UNIT_ECONOMICS_FIX"
  | "ACQUISITION_PUSH"
  | "EXPERIMENTATION_BOOTSTRAP";

export function generateStrategicPillars(ctx: StrategicContext): StrategyPillar[] {
  const hits = new Set<StrategyPillar>();
  if (ctx.churn >= 0.05) hits.add("RETENTION_FIRST");
  if (ctx.conversion < 0.02) hits.add("CONVERSION_OPTIMIZATION");
  if (ctx.ltv > 0 && ctx.cac > ctx.ltv) hits.add("UNIT_ECONOMICS_FIX");
  if (ctx.trend === "down" || ctx.growthRate < 0) hits.add("ACQUISITION_PUSH");
  if (ctx.experiments < 2) hits.add("EXPERIMENTATION_BOOTSTRAP");
  const order: StrategyPillar[] = [
    "RETENTION_FIRST",
    "CONVERSION_OPTIMIZATION",
    "UNIT_ECONOMICS_FIX",
    "ACQUISITION_PUSH",
    "EXPERIMENTATION_BOOTSTRAP",
  ];
  return order.filter((p) => hits.has(p));
}
