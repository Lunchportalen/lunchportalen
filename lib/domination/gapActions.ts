/**
 * Fra markedsgap til **etiske** tiltak — ingen aggressive taktikker (ingen falsk knapphet,
 * skjult prising, mørk mønster-CRO). Kun tydelig verdi, respekt for bruker, målbar forbedring.
 */
import "server-only";

import type { MarketGapFinding } from "@/lib/domination/marketGaps";

export type ActionTier = "low" | "medium" | "high";

export type RecommendedGapAction = {
  /** Referanse til {@link MarketGapFinding.id}. */
  gapId: string;
  /** Kopi av gap-beskrivelse for sporbarhet. */
  gapSummary: string;
  /** Konkret, etisk tiltak. */
  action: string;
  /** Forventet effekt på mål (konvertering, margin, tilfredshet) — fra gapets alvor. */
  expectedImpact: ActionTier;
  /** Ressursbehov (tid/roller). */
  effort: ActionTier;
  /**
   * Risiko for negativ bivirkning (merke, tillit, drift).
   * Brukes til prioritering: ved lik effekt velges lavere risiko.
   */
  risk: ActionTier;
  /** Korte begrunnelser (ingen automatisk innhenting). */
  rationale: string[];
};

type ActionTemplate = {
  action: string;
  effort: ActionTier;
  risk: ActionTier;
};

const GAP_ACTIONS: Record<string, ActionTemplate> = {
  weak_content_quality: {
    action:
      "Planlegg og publiser redaksjonelt sterkere innhold (klare svar på søk-intent, fakta, struktur) — én vertikal om gangen.",
    effort: "medium",
    risk: "low",
  },
  seo_organic_headwind: {
    action:
      "Gjennomgå teknisk SEO og innholdsdekning med målbar baseline; forbedre eksisterende sider før nye domener/sider.",
    effort: "medium",
    risk: "low",
  },
  weak_ux: {
    action:
      "Kjør en kort bruksflyt-revisjon (lesbarhet, steg, feilmeldinger) og implementer små, målte forbedringer i flyt.",
    effort: "medium",
    risk: "low",
  },
  low_engagement: {
    action:
      "Knytt tydelig verdi til neste steg (forklaring, forventning, bekreftelse) uten manipulerende mønstre.",
    effort: "medium",
    risk: "low",
  },
  funnel_friction: {
    action:
      "Kartlegg frafall per steg med eksplisitt måling; reduser friksjon (felter, validering, hastighet) trinnvis.",
    effort: "high",
    risk: "low",
  },
  low_pricing_power: {
    action:
      "Test posisjonering og verdiargument (tydelig differensiering, pakker) med kontrollert eksperiment — ikke aggressiv priskrig.",
    effort: "medium",
    risk: "medium",
  },
  delivery_reliability: {
    action:
      "Forbedre rutiner og kommunikasjon rundt tidsvinduer; sett målbar KPI for punktlighet og følg opp årsaker.",
    effort: "high",
    risk: "low",
  },
  slow_delivery_leadtime: {
    action:
      "Analyser ledetid i kjede (kjøkken → sjåfør → kunde); reduser ventetid uten å kompromisse mattrygghet.",
    effort: "high",
    risk: "medium",
  },
  reach_vs_competitors: {
    action:
      "Øk synlighet gjennom kvalitet og konsistens (innhold, partnerskap, merke) — unngå kjøpt oppmerksomhet uten avklart ROI.",
    effort: "high",
    risk: "low",
  },
  competitive_pressure_premium: {
    action:
      "Styrk dokumentert verdi og tillit (case, SLA, transparens) fremfor prisdumping; vurder nisje eller servicegrad.",
    effort: "medium",
    risk: "medium",
  },
};

function impactFromFinding(f: MarketGapFinding): ActionTier {
  return f.potentialImpact;
}

/**
 * Mapper et funnet gap til et anbefalt etisk tiltak.
 */
export function mapGapToAction(finding: MarketGapFinding): RecommendedGapAction {
  const tpl = GAP_ACTIONS[finding.id] ?? {
    action:
      "Sett mål, mål én forbedring om gangen, og evaluer utfall — uten press-taktikker eller skjulte vilkår.",
    effort: "medium" as const,
    risk: "low" as const,
  };

  return {
    gapId: finding.id,
    gapSummary: finding.gap,
    action: tpl.action,
    expectedImpact: impactFromFinding(finding),
    effort: tpl.effort,
    risk: tpl.risk,
    rationale: [
      `Basert på gap «${finding.gap}» (konfidens ${finding.confidence.toFixed(2)}).`,
      ...finding.signalsUsed.slice(0, 4),
    ],
  };
}

const tierRank: Record<ActionTier, number> = { high: 3, medium: 2, low: 1 };
const riskSort: Record<ActionTier, number> = { low: 1, medium: 2, high: 3 };

/**
 * Prioriterer: **høyest forventet effekt først**, deretter **lavest risiko** (etisk preferanse).
 */
export function prioritizeRecommendedActions(actions: RecommendedGapAction[]): RecommendedGapAction[] {
  return [...actions].sort((a, b) => {
    const ia = tierRank[a.expectedImpact];
    const ib = tierRank[b.expectedImpact];
    if (ib !== ia) return ib - ia;
    const ra = riskSort[a.risk];
    const rb = riskSort[b.risk];
    if (ra !== rb) return ra - rb;
    return tierRank[a.effort] - tierRank[b.effort];
  });
}

/**
 * Full pipeline: markedsgap → tiltak → sortert anbefaling.
 */
export function recommendActionsFromGaps(findings: MarketGapFinding[]): RecommendedGapAction[] {
  const list = Array.isArray(findings) ? findings : [];
  const mapped = list.map(mapGapToAction);
  return prioritizeRecommendedActions(mapped);
}
