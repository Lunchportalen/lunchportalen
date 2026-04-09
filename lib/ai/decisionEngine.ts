/**
 * Global beslutningsmotor V1 — deterministisk, forklarbar.
 * Output er forslag; policy/autonomi styrer visning og menneskelig overstyring.
 */

import { stableDecisionId } from "@/lib/ai/decisionId";
import type { BlackboxSignal } from "@/lib/ai/signalEngine";

export { withAiDecisionEntrypoint } from "@/lib/ai/aiEntrypointContext";

export type DecisionDomain = "menu" | "purchase" | "pricing" | "delivery";

export type EngineDecision = {
  id: string;
  type: DecisionDomain;
  action: string;
  /** Numerisk effekt: NOK, porsjoner eller indeks — tolkning i `expectedOutcome`. */
  impact: number;
  confidence: number;
  explanation: string;
  dataUsed: string[];
  expectedOutcome: string;
  /** Valgfri foreslått prisendring i % (for policy-sjekk). */
  proposedPriceDeltaPercent?: number | null;
};

export type DecisionEngineInput = {
  predictedOrders: number;
  forecastConfidence: number;
  topMenuKeys: string[];
  weakMenuKeys: string[];
  hindcastAbsError: number | null;
  procurementTotalKg: number;
  locationCount: number;
  weeklyPortionsEstimate: number;
  currentPriceExVat: number | null;
};

/** Input til vekst-/CRO-beslutningsmotoren (API, POS, dashbord). */
export type DecisionInputData = {
  conversionRate?: number;
  traffic?: number;
  engagementScore?: number;
  revenueProxy?: number;
  experimentWinRates?: number[];
  variantPerformance?: Array<{ id: string; lift: number }>;
  seoOrganicDelta?: number;
  funnelDropRate?: number;
  notes?: string;
};

export type DecisionType =
  | "increase_cta_visibility"
  | "create_seo_page"
  | "pause_underperforming_variant"
  | "refresh_content"
  | "funnel_optimize"
  | "no_action";

export type DecisionResult = {
  decisionType: DecisionType;
  recommendation: string;
  confidence: number;
  reason: string;
  basedOn: string[];
};

export type BusinessStateSignals = {
  conversionRate: number;
  churnRate: number;
  revenueGrowth: number;
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/**
 * Én forklarbar vekstbeslutning fra signaler — deterministisk, uten LLM.
 */
export function makeDecision(data: DecisionInputData = {}): DecisionResult {
  const variants = Array.isArray(data.variantPerformance) ? data.variantPerformance : [];
  let worst: { id: string; lift: number } | null = null;
  for (const v of variants) {
    if (!v || typeof v.id !== "string") continue;
    const lift = typeof v.lift === "number" && !Number.isNaN(v.lift) ? v.lift : Number(v.lift);
    if (!Number.isFinite(lift)) continue;
    if (lift < -0.05 && (worst == null || lift < worst.lift)) worst = { id: v.id, lift };
  }
  if (worst) {
    return {
      decisionType: "pause_underperforming_variant",
      recommendation: `Vurder pause eller redesign av variant «${worst.id}» (negativ lift).`,
      confidence: 0.62,
      reason: "Variant underpresterer ifølge signaldata — begrens eksponering til bedre kontroll.",
      basedOn: ["variantPerformance", worst.id],
    };
  }

  const funnel =
    typeof data.funnelDropRate === "number" && !Number.isNaN(data.funnelDropRate) ? data.funnelDropRate : 0;
  if (funnel > 0.35) {
    return {
      decisionType: "funnel_optimize",
      recommendation: "Analyser og stram opp steg med høyest frafall i funnelen.",
      confidence: 0.58,
      reason: `Funnel-frafall ${(funnel * 100).toFixed(0)} % indikerer friksjon som bør adresseres.`,
      basedOn: ["funnelDropRate"],
    };
  }

  const conv =
    typeof data.conversionRate === "number" && !Number.isNaN(data.conversionRate) ? data.conversionRate : 0;
  if (conv > 0 && conv < 0.03) {
    return {
      decisionType: "increase_cta_visibility",
      recommendation: "Øk synlighet og tydelighet for primær CTA på målpris og landingssider.",
      confidence: 0.55,
      reason: `Konvertering ${(conv * 100).toFixed(2)} % er under vekstterskel — CRO bør prioriteres.`,
      basedOn: ["conversionRate"],
    };
  }

  const seo =
    typeof data.seoOrganicDelta === "number" && !Number.isNaN(data.seoOrganicDelta) ? data.seoOrganicDelta : 0;
  if (seo < -0.02) {
    return {
      decisionType: "create_seo_page",
      recommendation: "Publiser målrettet innhold for søketermer med synkende organisk trafikk.",
      confidence: 0.52,
      reason: "Organisk trafikk faller — buffer med strukturert SEO-side og internlenker.",
      basedOn: ["seoOrganicDelta"],
    };
  }

  return {
    decisionType: "no_action",
    recommendation: "Ingen material endring anbefalt på nåværende signalsett.",
    confidence: 0.45,
    reason: "Signalene ligger innenfor moderate grenser — fortsett måling og observasjon.",
    basedOn: ["aggregate_metrics"],
  };
}

export function evaluateBusinessState(input: {
  conversionRate: number;
  churnRate: number;
  revenueGrowth: number;
}): BusinessStateSignals {
  return {
    conversionRate: Number.isFinite(input.conversionRate) ? input.conversionRate : 0,
    churnRate: Number.isFinite(input.churnRate) ? input.churnRate : 0,
    revenueGrowth: Number.isFinite(input.revenueGrowth) ? input.revenueGrowth : 0,
  };
}

/**
 * Kartlegger forretningssignal til allowlisted CEO-strenger (cron / kontrollplan).
 */
export function decideActions(signals: BusinessStateSignals): string[] {
  const out: string[] = [];
  if (signals.conversionRate < 0.025) out.push("OPTIMIZE_PAGE");
  if (signals.churnRate > 0.08) out.push("REFRESH_CONTENT");
  if (signals.revenueGrowth < 0) out.push("RUN_EXPERIMENT");
  return [...new Set(out)];
}

/**
 * Blackbox signal-sett → samme allowlist som {@link decideActions} der det gir mening.
 */
export function decideBlackboxActions(signals: readonly BlackboxSignal[]): string[] {
  const out: string[] = [];
  for (const s of signals) {
    if (s === "LOW_CONVERSION") out.push("OPTIMIZE_PAGE");
    if (s === "NO_EXPERIMENTS" || s === "NEGATIVE_REVENUE") out.push("RUN_EXPERIMENT");
    if (s === "HIGH_CHURN") out.push("REFRESH_CONTENT");
  }
  return [...new Set(out)];
}

/**
 * Bygger et lite sett med ikke-overlappende forslag.
 * Usikkerhet (lav konfidans / manglende data) → færre eller ingen beslutninger (fail-safe).
 */
export function buildEngineDecisions(input: DecisionEngineInput): EngineDecision[] {
  const out: EngineDecision[] = [];
  const dataOrders = "ordrehistorikk + day_choices (siste vindu)";
  const dataForecast = "demandEngine V1 (like ukedager + trend + avbestillingsrate)";

  if (input.predictedOrders > 0 && input.topMenuKeys.length > 0) {
    const top = input.topMenuKeys[0]!;
    out.push({
      id: stableDecisionId(["menu", "promote", top, String(input.predictedOrders)]),
      type: "menu",
      action: `Vektlegg «${top}» i ukemeny (høyest historisk volum).`,
      impact: input.weeklyPortionsEstimate,
      confidence: clamp01(input.forecastConfidence * 0.95),
      explanation: `Menyvalget «${top}» dominerer nylig etterspørsel — øk synlighet/planlegg kapasitet.`,
      dataUsed: [dataOrders, dataForecast],
      expectedOutcome: "Mer forutsigbar produksjon og færre overraskelser på toppdager.",
    });
  }

  if (input.weakMenuKeys.length > 0) {
    const w = input.weakMenuKeys[0]!;
    out.push({
      id: stableDecisionId(["menu", "rotate", w]),
      type: "menu",
      action: `Vurder å rotere eller erstatte lavvolum-valg «${w}».`,
      impact: -1,
      confidence: 0.55,
      explanation: "Lavt volum over tid øker risiko for svinn og faste kostnader per porsjon.",
      dataUsed: [dataOrders],
      expectedOutcome: "Lavere svinnrisiko eller tydeligere kundeprofil for menyen.",
    });
  }

  if (input.procurementTotalKg > 0 && input.predictedOrders >= 15) {
    out.push({
      id: stableDecisionId(["purchase", "batch", String(Math.round(input.procurementTotalKg * 10))]),
      type: "purchase",
      action: "Samle innkjøp i én batch med avtalt leverandør (manuell bestilling).",
      impact: Math.round(input.procurementTotalKg * 100) / 100,
      confidence: clamp01(0.5 + input.forecastConfidence * 0.35),
      explanation: "Høyt prognostisert volum tilsier batch som reduserer administrasjon og transportkost (indikativt).",
      dataUsed: [dataForecast, "procurementEngine (meny→ingrediens)"],
      expectedOutcome: "Enklere mottak og færre delleveranser.",
    });
  }

  if (input.currentPriceExVat != null && input.currentPriceExVat > 0) {
    const err = input.hindcastAbsError ?? 0;
    const delta = err > 3 ? 5 : err < 2 ? -5 : 0;
    if (delta !== 0) {
      out.push({
        id: stableDecisionId(["pricing", String(delta), String(input.currentPriceExVat)]),
        type: "pricing",
        action: delta > 0 ? `Øk pris på standard porsjon med ${delta} % (forslag).` : `Vurder rabatt/prisjustering ${Math.abs(delta)} % (forslag).`,
        impact: Math.round(input.currentPriceExVat * (delta / 100) * 100) / 100,
        confidence: 0.45,
        explanation:
          delta > 0
            ? "Hindcast viste høyere faktisk etterspørsel enn modell — forsiktig prisjustering innen avtalegrenser."
            : "Stabil etterspørsel — forsiktig justering kan øke fyllingsgrad (verifiser kontrakt).",
        dataUsed: [dataForecast, "hindcast (predicted vs actual)", "selskapspris eks. mva"],
        expectedOutcome: "Margin eller volum balanseres — krever alltid juridisk/økonomisk sjekk.",
        proposedPriceDeltaPercent: delta,
      });
    }
  }

  if (input.locationCount >= 2) {
    out.push({
      id: stableDecisionId(["delivery", "route", String(input.locationCount)]),
      type: "delivery",
      action: "Følg foreslått stop-rekkefølge (tidlig vindu først), bekreft med sjåfør.",
      impact: input.locationCount,
      confidence: 0.72,
      explanation: "Deterministisk sortering reduserer risiko for vindu-brudd sammenlignet med vilkårlig rekkefølge.",
      dataUsed: ["company_locations", "routePlanner V1"],
      expectedOutcome: "Jevnere ankomst innen leveringsvindu.",
    });
  }

  if (input.forecastConfidence < 0.35 && out.length > 0) {
    return [];
  }

  return out;
}
