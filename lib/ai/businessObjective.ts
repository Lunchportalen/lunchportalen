import "server-only";

import type { PlatformAiBillingOverview } from "@/lib/ai/usageOverview";

/** Persisted platform snapshot for period-over-period growth vs objective. */
export type ObjectiveCheckpoint = {
  period: string;
  margin_usd: number | null;
  list_mrr_usd: number | null;
  total_runs: number;
  /** Composite score at the time this checkpoint was written (0–1). */
  objective_score: number;
};

export type BusinessObjectiveWeights = {
  w_margin: number;
  w_revenue: number;
  w_growth: number;
};

/** Platform AI governance strategy: auto-selected from gaps unless env forces a mode. */
export type StrategyMode = "profit" | "growth" | "balance";

export type ObjectiveExecutionContext = {
  score: number;
  stress: number;
  strategy_mode: StrategyMode;
  /** 0–1: margin below target (drives cost-control bias). */
  margin_gap_stress: number;
  /** 0–1: growth below target (dampens throttle auto; protects expansion). */
  growth_gap_stress: number;
  /** Weights after base env + target-gap adjustment (sum 1). */
  effective_weights: BusinessObjectiveWeights;
  execution_confidence_mult: number;
  min_auto_confidence_delta: number;
  cooldown_multiplier_delta: number;
  /** Applied to downgrade combined confidence (≥1 when margin gap). */
  downgrade_gap_scale: number;
  /** Applied to throttle combined confidence (≤1 when growth gap). */
  throttle_gap_scale: number;
};

/** Resolved targets (env + safe fallbacks from live overview). */
export type ObjectiveTargetsResolved = {
  target_margin_usd: number;
  target_growth_rel: number;
};

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function envFloat(key: string, fallback: number): number {
  const raw = String(process.env[key] ?? "").trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function defaultObjectiveWeights(): BusinessObjectiveWeights {
  return { w_margin: 0.45, w_revenue: 0.35, w_growth: 0.2 };
}

/** Env: AI_OBJECTIVE_W_MARGIN, AI_OBJECTIVE_W_REVENUE, AI_OBJECTIVE_W_GROWTH (normalized to sum 1). */
/**
 * AI_OBJECTIVE_STRATEGY_MODE=auto|profit|growth|balance — force mode or let gaps decide (default auto).
 */
export function readStrategyOverrideFromEnv(): StrategyMode | null {
  const v = String(process.env.AI_OBJECTIVE_STRATEGY_MODE ?? "auto").trim().toLowerCase();
  if (v === "profit" || v === "growth" || v === "balance") return v;
  return null;
}

/**
 * Auto strategy from margin vs growth gap; light hysteresis on `previous` to reduce flapping.
 */
export function inferStrategyMode(
  marginGapStress: number,
  growthGapStress: number,
  previous: StrategyMode | null,
): StrategyMode {
  const mg = clamp01(marginGapStress);
  const gg = clamp01(growthGapStress);
  const diff = mg - gg;
  const candidate: StrategyMode =
    diff > 0.14 ? "profit" : diff < -0.14 ? "growth" : "balance";

  if (!previous || previous === candidate) return candidate;

  if (previous === "profit" && candidate === "growth" && diff > -0.22) return "profit";
  if (previous === "growth" && candidate === "profit" && diff < 0.22) return "growth";
  if (candidate === "balance") {
    if (previous === "profit" && diff > 0.07) return "profit";
    if (previous === "growth" && diff < -0.07) return "growth";
  }
  return candidate;
}

/** Tighten/relax targets per strategy (after base env targets). */
export function applyStrategyToTargets(
  t: ObjectiveTargetsResolved,
  mode: StrategyMode,
): ObjectiveTargetsResolved {
  if (mode === "profit") {
    return {
      target_margin_usd: t.target_margin_usd * 1.06,
      target_growth_rel: Math.max(0.002, t.target_growth_rel * 0.94),
    };
  }
  if (mode === "growth") {
    return {
      target_margin_usd: Math.max(0, t.target_margin_usd * 0.96),
      target_growth_rel: Math.min(0.5, t.target_growth_rel * 1.1),
    };
  }
  return { ...t };
}

/** Pivot weights after gap pass — emphasizes margin in profit, growth in growth. */
export function applyStrategyToWeights(w: BusinessObjectiveWeights, mode: StrategyMode): BusinessObjectiveWeights {
  let m = w.w_margin;
  let g = w.w_growth;
  const r = w.w_revenue;
  if (mode === "profit") {
    m *= 1.12;
    g *= 0.88;
  } else if (mode === "growth") {
    m *= 0.88;
    g *= 1.12;
  }
  const s = m + g + r;
  return { w_margin: m / s, w_revenue: r / s, w_growth: g / s };
}

export function readObjectiveWeightsFromEnv(): BusinessObjectiveWeights {
  const wMargin = envFloat("AI_OBJECTIVE_W_MARGIN", 0.45);
  const wRev = envFloat("AI_OBJECTIVE_W_REVENUE", 0.35);
  const wGrowth = envFloat("AI_OBJECTIVE_W_GROWTH", 0.2);
  const sum = wMargin + wRev + wGrowth;
  if (!(sum > 0)) return defaultObjectiveWeights();
  return {
    w_margin: wMargin / sum,
    w_revenue: wRev / sum,
    w_growth: wGrowth / sum,
  };
}

/**
 * Target state (env). Margin: AI_OBJECTIVE_TARGET_MARGIN_USD (optional; else max(min_dashboard_floor, 100) USD proxy).
 * Growth: AI_OBJECTIVE_TARGET_GROWTH_REL — blended MoM MRR+runs pace (default 0.04).
 */
export function readObjectiveTargets(overview: PlatformAiBillingOverview): ObjectiveTargetsResolved {
  const tmRaw = String(process.env.AI_OBJECTIVE_TARGET_MARGIN_USD ?? "").trim();
  let target_margin_usd: number;
  if (tmRaw) {
    const n = Number(tmRaw);
    target_margin_usd = Number.isFinite(n) ? n : Math.max(0, overview.alerts.min_margin_usd);
  } else {
    const floor = Math.max(0, overview.alerts.min_margin_usd);
    target_margin_usd = floor > 0 ? floor : 100;
  }
  const tg = envFloat("AI_OBJECTIVE_TARGET_GROWTH_REL", 0.04);
  const target_growth_rel = Math.min(0.5, Math.max(0.002, tg));
  return { target_margin_usd, target_growth_rel };
}

/** Blended realized MoM-style growth (MRR + runs); null if not comparable to prior period. */
export function computeAchievedGrowthRel(
  overviewPeriod: string,
  prior: ObjectiveCheckpoint | null | undefined,
  cur: {
    total_list_mrr_usd: number | null;
    total_runs: number;
    revenue_partial: boolean;
  },
): number | null {
  if (!prior || prior.period >= overviewPeriod) return null;
  if (cur.revenue_partial || cur.total_list_mrr_usd == null || prior.list_mrr_usd == null) return null;
  const mrrRel =
    prior.list_mrr_usd > 0 ? (cur.total_list_mrr_usd - prior.list_mrr_usd) / prior.list_mrr_usd : 0;
  const runsRel = prior.total_runs > 0 ? (cur.total_runs - prior.total_runs) / prior.total_runs : 0;
  return 0.55 * mrrRel + 0.45 * runsRel;
}

function marginGapStress(
  marginUsd: number | null,
  revenuePartial: boolean,
  targetMarginUsd: number,
): number {
  if (revenuePartial || marginUsd == null) return clamp01(0.42);
  const deficit = targetMarginUsd - marginUsd;
  if (deficit <= 0) return 0;
  const scale = Math.max(35, Math.abs(targetMarginUsd) * 0.45 + 25);
  return clamp01(deficit / scale);
}

function growthGapStress(achievedRel: number | null, targetRel: number): number {
  if (achievedRel == null) return clamp01(0.28);
  const deficit = targetRel - achievedRel;
  if (deficit <= 0) return 0;
  return clamp01(deficit / 0.07);
}

/**
 * Shift objective weights toward dimensions that are behind target (still normalized).
 */
export function adjustWeightsForTargetGaps(
  base: BusinessObjectiveWeights,
  marginGapStress: number,
  growthGapStress: number,
): BusinessObjectiveWeights {
  const m = base.w_margin * (1 + 0.55 * marginGapStress);
  const g = base.w_growth * (1 + 0.55 * growthGapStress);
  const r = base.w_revenue;
  const sum = m + g + r;
  return {
    w_margin: m / sum,
    w_revenue: r / sum,
    w_growth: g / sum,
  };
}

function normMargin(marginUsd: number | null, revenuePartial: boolean, minMarginUsd: number): number {
  if (revenuePartial || marginUsd == null) return 0.46;
  const ref = Math.max(40, Math.abs(minMarginUsd) + 20);
  return clamp01(0.48 + (marginUsd / ref) * 0.38);
}

function normRevenue(listMrrUsd: number | null, revenuePartial: boolean): number {
  if (revenuePartial || listMrrUsd == null) return 0.46;
  const ref = 400;
  return clamp01(0.4 + (Math.log1p(listMrrUsd) / Math.log1p(ref)) * 0.48);
}

/**
 * Growth vs prior checkpoint (revenue + usage velocity). Neutral when same period or missing prior.
 */
function normGrowth(
  overviewPeriod: string,
  prior: ObjectiveCheckpoint | null | undefined,
  cur: {
    total_list_mrr_usd: number | null;
    total_runs: number;
    revenue_partial: boolean;
  },
): number {
  if (!prior || prior.period >= overviewPeriod) return 0.52;
  if (cur.revenue_partial || cur.total_list_mrr_usd == null || prior.list_mrr_usd == null) return 0.5;
  const mrrRel =
    prior.list_mrr_usd > 0 ? (cur.total_list_mrr_usd - prior.list_mrr_usd) / prior.list_mrr_usd : 0;
  const runsRel = prior.total_runs > 0 ? (cur.total_runs - prior.total_runs) / prior.total_runs : 0;
  const g = 0.48 + 0.34 * Math.tanh(mrrRel * 2.2) + 0.28 * Math.tanh(runsRel * 1.6);
  return clamp01(g);
}

/**
 * Weighted composite of margin, revenue (list MRR), and growth vs prior checkpoint.
 * Higher is closer to the configured business objective.
 *
 * Alias: `objectiveFunction` — single entry point for “business objective” scoring.
 */
export function computeObjectiveScore(
  overview: PlatformAiBillingOverview,
  prior: ObjectiveCheckpoint | null | undefined,
  weights: BusinessObjectiveWeights,
): number {
  const t = overview.totals;
  const sm = normMargin(t.margin_usd, t.revenue_partial, overview.alerts.min_margin_usd);
  const sr = normRevenue(t.total_list_mrr_usd, t.revenue_partial);
  const sg = normGrowth(overview.period, prior, t);
  return clamp01(weights.w_margin * sm + weights.w_revenue * sr + weights.w_growth * sg);
}

/** Canonical alias for {@link computeObjectiveScore}. */
export const objectiveFunction = computeObjectiveScore;

/** Dashboard `business_engine.strategy_override` wins over env `AI_OBJECTIVE_STRATEGY_MODE`. */
export type StrategyOverrideLayer = {
  mode: StrategyMode | null;
  source: "dashboard" | "env" | null;
};

export function resolveStrategyOverrideLayer(
  business_engine?: { strategy_override?: StrategyMode | null } | null,
): StrategyOverrideLayer {
  const s = business_engine?.strategy_override;
  if (s === "profit" || s === "growth" || s === "balance") return { mode: s, source: "dashboard" };
  const e = readStrategyOverrideFromEnv();
  if (e) return { mode: e, source: "env" };
  return { mode: null, source: null };
}

export type TrustIndicatorSignal = "god" | "middels" | "oppmerksom";

export type TrustIndicator = {
  title: string;
  body: string;
  signal: TrustIndicatorSignal;
};

export type DecisionExplanationTelemetry = {
  checkpoint_period: string | null;
  overview_period: string;
  telemetry_samples: number;
  /** Snitt av outcome_adjusted_confidence på relevante anbefalinger (0–1), eller null. */
  avg_recommendation_confidence: number | null;
  /** Antall anbefalinger med severity critical (styrer «Ta kontroll»). */
  critical_recommendation_count: number;
  /** Forrige lagrede sjekkpunkt — margin (USD), for bevis i salgsblokk. */
  checkpoint_margin_usd: number | null;
  /** Forrige lagrede sjekkpunkt — Forretningsscore 0–1, for indikator vs nå. */
  checkpoint_objective_score: number | null;
};

/** Forretningsscore 0–1 mappet til salgs-/UI-merkelapp. */
export type ForretningsscoreBand = "lav" | "stabil" | "sterk" | "optimal";

export type StyringsanbefalingKode = "la_ai_styre" | "folg_med" | "ta_kontroll";

export type Prognose7Dager = {
  ingress: string;
  punkter: string[];
  disclaimer: string;
};

export type DecisionExplanation = {
  headline: string;
  bullets: string[];
  /** Øyeblikkelig toppoppsummering (full setning, starter typisk med «AI jobber nå med å …»). */
  ai_jobber_med: string;
  /** Merkelapp for Forretningsscore (Lav / Stabil / Sterk / Optimal). */
  forretningsscore_band: ForretningsscoreBand;
  forretningsscore_band_forklaring: string;
  prognose_7_dager: Prognose7Dager;
  styringsanbefaling_kode: StyringsanbefalingKode;
  styringsanbefaling_tittel: string;
  styringsanbefaling_begrunnelse: string;
  /** Én setning: hva Forretningsscore betyr for kunden. */
  forretningsscore_hva_er_det: string;
  /** Klart språk: nåværende prioritering. */
  hva_skjer_na: string;
  /** Klart språk: hva som typisk skjer videre. */
  hva_forventer_vi: string;
  /** Konkret effekt / konsekvens i korte punkter. */
  effekt_i_korthet: string[];
  tillit: TrustIndicator[];
  konfidens: { niva: string; forklaring: string };
  /** Salgs-/produktblokk (ærlige tall der data finnes). */
  salgsblokk_overskrift: string;
  /** Fortelling: problem (uten motor). */
  historie_problem_overskrift: string;
  historie_problem_punkter: string[];
  /** Fortelling: hva motoren gjør (transformasjon). */
  historie_transformasjon_overskrift: string;
  historie_transformasjon_punkter: string[];
  /** Fortelling: kundeutfall. */
  historie_resultat_overskrift: string;
  historie_resultat_punkter: string[];
  /** Ramme rundt tallene under (logisk + emosjonell bro). */
  historie_bevis_overskrift: string;
  historie_bevis_ingress: string;
  /** Relativ endring margin (AI-linje) vs forrige sjekkpunkt, %. Null uten sammenlignbart grunnlag. */
  bevis_margin_forbedring_pct: number | null;
  bevis_margin_tekst: string;
  /**
   * Indikator for «mindre manuelt styringsbehov»: relativ utvikling i Forretningsscore vs sjekkpunkt.
   * Ikke timeregistrering — se `bevis_tid_tekst`.
   */
  bevis_tid_besparelse_indikator_pct: number | null;
  bevis_tid_tekst: string;
  bevis_disclaimer: string;
  cta_start_ai_styring_label: string;
  cta_start_ai_styring_href: string;
};

const STRATEGY_LABEL_NB: Record<StrategyMode, string> = {
  profit: "Margin først (profit)",
  growth: "Vekst først",
  balance: "Balansert",
};

export function strategyTelemetrySampleCount(
  st: { by_mode?: Partial<Record<StrategyMode, { samples: number }>> } | null | undefined,
): number {
  if (!st?.by_mode) return 0;
  let n = 0;
  for (const v of Object.values(st.by_mode)) n += Math.max(0, v?.samples ?? 0);
  return n;
}

function trustSignalFromSamples(n: number): TrustIndicatorSignal {
  if (n >= 12) return "god";
  if (n >= 4) return "middels";
  return "oppmerksom";
}

export function forretningsscoreBand(score: number): ForretningsscoreBand {
  const s = clamp01(score);
  if (s < 0.38) return "lav";
  if (s < 0.55) return "stabil";
  if (s < 0.72) return "sterk";
  return "optimal";
}

function forretningsscoreBandForklaringNb(b: ForretningsscoreBand): string {
  switch (b) {
    case "lav":
      return "Under forventet spor — flere tiltak og tettere oppfølging er naturlig.";
    case "stabil":
      return "Innenfor et akseptabelt spor, med tydelig rom for forbedring.";
    case "sterk":
      return "Godt resultat mot mål — færre dramatiske grep forventes.";
    case "optimal":
      return "Svært sterkt utfall mot sammenligningsgrunnlag og mål.";
  }
}

function buildAiJobberMed(r: ResolvedPlatformObjective): string {
  if (r.strategy_mode === "profit") {
    return r.margin_gap_stress > 0.22
      ? "AI jobber nå med å beskytte margin på AI-linjen og prioritere kost- og modelltiltak der gapet er størst."
      : "AI jobber nå med å holde margin trygg uten å strupe vekst mer enn nødvendig.";
  }
  if (r.strategy_mode === "growth") {
    return r.growth_gap_stress > 0.22
      ? "AI jobber nå med å løfte vekst i bruk og inntekt og dempe automatiske inngrep som kan hemme bruken."
      : "AI jobber nå med å legge til rette for vekst samtidig som kostnader holdes i sjakk.";
  }
  return "AI jobber nå med å balansere margin og vekst ut fra faktiske gap og lagret historikk denne perioden.";
}

function billingDaysForPrognose(
  bounds: { start: string; end: string },
  nowMs: number,
): { daysElapsed: number; daysLeftInPeriod: number } {
  const start = Date.parse(bounds.start);
  const end = Date.parse(bounds.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { daysElapsed: 1, daysLeftInPeriod: 7 };
  }
  const clamped = Math.min(Math.max(nowMs, start), end);
  const msDay = 86_400_000;
  const daysElapsed = Math.max(1, Math.ceil((clamped - start) / msDay));
  const daysLeftInPeriod = Math.max(0, Math.ceil((end - clamped) / msDay));
  return { daysElapsed, daysLeftInPeriod };
}

function buildPrognose7Dager(
  overview: PlatformAiBillingOverview,
  totalRuns: number,
  r: ResolvedPlatformObjective,
  nowMs: number,
): Prognose7Dager {
  const disclaimer =
    "Prognosen bygger på enkel trending av hittil-bruk i perioden — ikke en garanti, og faktisk atferd kan endre seg raskt.";

  if (totalRuns < 1) {
    return {
      ingress: "De neste 7 dagene (uten etablert tempo i perioden):",
      punkter: [
        "Få eller ingen AI-kjøringer er registrert hittil — volum neste uke avhenger av hvordan plattformen brukes.",
        r.strategy_mode === "profit"
          ? "Ved press på margin kan anbefalinger likevel komme raskt når nye tall lander."
          : r.strategy_mode === "growth"
            ? "Vekstfokus gjør at verktøy holdes åpne inntil data tilsier noe annet."
            : "Balansert modus oppdaterer forslag fortløpende når bruk og økonomi beveger seg.",
      ],
      disclaimer,
    };
  }

  const { daysElapsed } = billingDaysForPrognose(overview.period_bounds_utc, nowMs);
  const runsPerDay = totalRuns / daysElapsed;
  const projected7 = Math.max(0, Math.round(runsPerDay * 7));

  const punkter: string[] = [
    `Hittil i perioden: ca. ${runsPerDay.toFixed(1)} AI-kjøringer per dag i snitt (fra periodestart til nå).`,
    `Ved uendret tempo: om lag ${projected7} kjøringer de neste 7 dagene (tilnærmet projeksjon).`,
  ];
  if (r.margin_gap_stress > 0.3) {
    punkter.push("Høyt margin-trykk kan samtidig utløse flere forslag om modell- eller kostbegrensning.");
  } else if (r.growth_gap_stress > 0.3) {
    punkter.push("Vekst under mål: forvent færre automatiske verktøy-stopp og mer rom for bruk.");
  } else {
    punkter.push("Strategi og anbefalinger justeres når nye kall og fakturadata oppdateres.");
  }

  return {
    ingress: "Prognose neste 7 dager (fra dagens tempo i perioden):",
    punkter,
    disclaimer,
  };
}

function buildTaKontrollBegrunnelse(
  r: ResolvedPlatformObjective,
  overview: PlatformAiBillingOverview,
  criticalRecs: number,
): string {
  const reasons: string[] = [];
  if (overview.totals.revenue_partial) reasons.push("delvis inntektsgrunnlag");
  if (r.score < 0.36) reasons.push("lav Forretningsscore");
  if (r.exec.stress > 0.7) reasons.push("høyt samlet trykk");
  if (overview.alerts.margin_below_threshold) reasons.push("margin under terskel");
  if (overview.alerts.any_company_flagged) reasons.push("flagget selskap for faktureringsoppfølging");
  if (criticalRecs >= 1) reasons.push("kritiske anbefalinger");
  const tail = reasons.length ? reasons.slice(0, 4).join(", ") : "flere risikosignal samtidig";
  return `Aktiv oppfølging anbefales: ${tail}.`;
}

function resolveStyringsanbefaling(args: {
  r: ResolvedPlatformObjective;
  overview: PlatformAiBillingOverview;
  historikkGod: boolean;
  criticalRecs: number;
}): { kode: StyringsanbefalingKode; tittel: string; begrunnelse: string } {
  const { r, overview, historikkGod, criticalRecs } = args;
  const a = overview.alerts;
  const stress = r.exec.stress;

  const taKontroll =
    overview.totals.revenue_partial ||
    r.score < 0.36 ||
    stress > 0.7 ||
    a.margin_below_threshold ||
    a.any_company_flagged ||
    criticalRecs >= 1;

  if (taKontroll) {
    return {
      kode: "ta_kontroll",
      tittel: "Ta kontroll",
      begrunnelse: buildTaKontrollBegrunnelse(r, overview, criticalRecs),
    };
  }

  const laAi =
    r.score >= 0.6 &&
    stress < 0.42 &&
    !overview.totals.revenue_partial &&
    !a.margin_below_threshold &&
    !a.any_company_flagged &&
    historikkGod &&
    criticalRecs === 0;

  if (laAi) {
    return {
      kode: "la_ai_styre",
      tittel: "La AI styre",
      begrunnelse:
        "Score, varsler og datagrunnlag er solide — automatikk pluss månedlig sjekkpunkt gir tilstrekkelig innsyn akkurat nå.",
    };
  }

  return {
    kode: "folg_med",
    tittel: "Følg med",
    begrunnelse:
      "Bildet er verken kritisk eller «grønt lys» — sjekk anbefalinger jevnlig og vær klar til å justere strategi ved endringer.",
  };
}

function relEndringProsent(prev: number, neste: number): number | null {
  if (!Number.isFinite(prev) || !Number.isFinite(neste)) return null;
  const den = Math.abs(prev);
  if (den < 1e-9) return null;
  return ((neste - prev) / den) * 100;
}

function buildSalgsblokk(
  r: ResolvedPlatformObjective,
  overview: PlatformAiBillingOverview,
  telemetry: DecisionExplanationTelemetry,
  historikkGod: boolean,
): Pick<
  DecisionExplanation,
  | "salgsblokk_overskrift"
  | "historie_problem_overskrift"
  | "historie_problem_punkter"
  | "historie_transformasjon_overskrift"
  | "historie_transformasjon_punkter"
  | "historie_resultat_overskrift"
  | "historie_resultat_punkter"
  | "historie_bevis_overskrift"
  | "historie_bevis_ingress"
  | "bevis_margin_forbedring_pct"
  | "bevis_margin_tekst"
  | "bevis_tid_besparelse_indikator_pct"
  | "bevis_tid_tekst"
  | "bevis_disclaimer"
  | "cta_start_ai_styring_label"
  | "cta_start_ai_styring_href"
> {
  const curMargin = overview.totals.margin_usd;
  const prevMargin = telemetry.checkpoint_margin_usd;

  let bevis_margin_forbedring_pct: number | null = null;
  let bevis_margin_tekst: string;

  if (overview.totals.revenue_partial) {
    bevis_margin_tekst =
      "Full margin-bevis krever komplett inntektsgrunnlag (list MRR). Tallene oppdateres når data er komplette.";
  } else if (!historikkGod || prevMargin == null || curMargin == null) {
    bevis_margin_tekst =
      "Sammenligning mot forrige lagrede sjekkpunkt mangler ennå — margin i % vises etter neste sjekk.";
  } else {
    bevis_margin_forbedring_pct = relEndringProsent(prevMargin, curMargin);
    bevis_margin_tekst =
      bevis_margin_forbedring_pct == null
        ? "Kunne ikke beregne margin-endring (ustabil referanse)."
        : `Relativ utvikling i margin på AI-linje mot sjekkpunkt ${telemetry.checkpoint_period ?? "—"} (samme metode som i økonomioppsummeringen).`;
  }

  const prevScore = telemetry.checkpoint_objective_score;
  let bevis_tid_besparelse_indikator_pct: number | null = null;
  let bevis_tid_tekst: string;

  if (!historikkGod || prevScore == null || !Number.isFinite(prevScore)) {
    bevis_tid_tekst =
      "Timer logges ikke automatisk. Prosent under vises når Forretningsscore kan sammenlignes med forrige sjekkpunkt — som indikator for mindre manuelt styringsbehov, ikke timelistetall.";
  } else {
    bevis_tid_besparelse_indikator_pct = relEndringProsent(prevScore, r.score);
    bevis_tid_tekst =
      "Indikator for tidsbesparelse: relativ utvikling i Forretningsscore mot forrige sjekkpunkt (høyere score = roligere drift med mindre manuelle inngrep). Erstatter ikke faktisk timemåling.";
  }

  const bevis_disclaimer =
    "Alle prosenttall er hentet fra plattformens faktiske AI- og økonomidata. De er forklaring og indikator — ikke garanti for fremtidig resultat.";

  const harMåltBevis =
    bevis_margin_forbedring_pct != null || bevis_tid_besparelse_indikator_pct != null;
  const historie_bevis_ingress = harMåltBevis
    ? "Her er målte endringer fra deres egen plattform mot forrige lagrede sjekkpunkt — ikke salgstall fra brosjyren."
    : "Bevisradene fylles med ekte tall så snart et sammenlignbart sjekkpunkt finnes; inntil da er historien likevel tydelig i drift og styring.";

  return {
    salgsblokk_overskrift: "AI styrer lønnsomheten din – automatisk",
    historie_problem_overskrift: "Problemet uten en felles motor",
    historie_problem_punkter: [
      "Kost, modeller og varsler fordeles manuelt — uten én felles prioritering på tvers av selskaper",
      "Strategi og tiltak lander i møter, e-post og regneark — sent, fragmentert og vanskelig å spore",
      "Margin og vekst sees ofte først når perioden er lukket — reaksjonen kommer etter at bildet er dannet",
    ],
    historie_transformasjon_overskrift: "Transformasjonen: hva AI-motoren gjør",
    historie_transformasjon_punkter: [
      "Leser faktisk AI-bruk, kost og list MRR fortløpende — innenfor deres tenant og styring",
      "Velger og holder strategi (margin / vekst / balanse) med rolig hysterese — mindre ping-pong",
      "Oppdaterer vekter, auto-bias og anbefalinger ut fra målte gap — synlig i Forretningsscore og prognose",
    ],
    historie_resultat_overskrift: "Resultatet dere oppnår",
    historie_resultat_punkter: [
      "Tydelig bilde av lønnsomhet på AI-linjen — før situasjonen blir uoversiktlig",
      "Færre tilfeldige grep: tiltakene matcher faktiske gap, med tydelig anbefaling (La AI styre / Følg med / Ta kontroll)",
      "Teamet slipper å gjette: tillit, konfidens og teknisk utdyping ligger samlet — beslutninger blir roligere",
    ],
    historie_bevis_overskrift: "Bevis — ekte tall fra portalen",
    historie_bevis_ingress,
    bevis_margin_forbedring_pct,
    bevis_margin_tekst,
    bevis_tid_besparelse_indikator_pct,
    bevis_tid_tekst,
    bevis_disclaimer,
    cta_start_ai_styring_label: "Start med AI-styring",
    cta_start_ai_styring_href: "/backoffice/ai",
  };
}

/**
 * Norsk kunde- og driftsforklaring: Forretningsscore, nå/forventet, tillit og konfidens.
 */
export function buildDecisionExplanation(
  r: ResolvedPlatformObjective,
  overview: PlatformAiBillingOverview,
  telemetry: DecisionExplanationTelemetry,
): DecisionExplanation {
  const t = overview.totals;
  const pct = (x: number) => `${(x * 100).toFixed(0)}`;
  const pct1 = (x: number) => `${(x * 100).toFixed(1)}`;
  const nowMs = Date.now();

  const strat =
    r.strategy_override_source === "dashboard"
      ? "Strategi er satt manuelt i dashboard (overstyrer automatikk)."
      : r.strategy_override_source === "env"
        ? "Strategi er låst via miljøvariabel AI_OBJECTIVE_STRATEGY_MODE."
        : "Strategi er valgt automatisk ut fra margin-gap mot vekst-gap (med hysterese).";

  const bullets: string[] = [
    strat,
    `Aktiv modus: ${STRATEGY_LABEL_NB[r.strategy_mode]}. Mål justeres per modus, deretter vekter og auto-bias.`,
    `Forretningsscore ${pct1(r.score)} % (0–100 %) — vektet margin, list MRR og vekst mot forrige sjekkpunkt.`,
  ];

  if (!t.revenue_partial && t.margin_usd != null) {
    bullets.push(
      `Faktisk margin (AI-linje): ${t.margin_usd.toFixed(2)} USD. Mål etter modus: ca. ${r.targets.target_margin_usd.toFixed(2)} USD.`,
    );
  } else {
    bullets.push("Margin mot mål kan ikke tallfestes fullt (delvis MRR-oppsett).");
  }

  if (r.achieved_growth_rel != null) {
    bullets.push(
      `Realisert blandet vekst (MRR + bruk): ${(r.achieved_growth_rel * 100).toFixed(2)} % mot forrige periode. Mål: ${(r.targets.target_growth_rel * 100).toFixed(2)} %.`,
    );
  } else {
    bullets.push("Vekst sammenlignes når forrige sjekkpunkt finnes (ny periode eller manglende data).");
  }

  bullets.push(
    `Gap (basis): margin ${pct(r.margin_gap_base)} %, vekst ${pct(r.growth_gap_base)} % — styrer modus når ikke overstyrt.`,
  );
  bullets.push(
    `Auto-tiltak: modellnedgradering skaleres med margin-behov; verktøy-throttle dempes når vekst er under mål.`,
  );

  const forretningsscore_hva_er_det = `Forretningsscore (${pct1(r.score)} %) er et samlet tall for hvor godt dere ligger an på margin, inntektsbilde og vekst mot forrige lagrede sjekkpunkt. Høyere er bedre; lav score betyr at systemet vekter kost- eller veksttiltak sterkere.`;

  let hva_skjer_na: string;
  if (r.strategy_mode === "profit") {
    const tail =
      r.margin_gap_stress > 0.22
        ? "Margin ligger tydelig under mål — kost og modellnivå vektes opp."
        : "Systemet holder ekstra fokus på lønnsomhet uten å kneble vekst mer enn nødvendig.";
    hva_skjer_na = `Akkurat nå prioriterer motoren margin på AI-linjen. ${tail}`;
  } else if (r.strategy_mode === "growth") {
    const tail =
      r.growth_gap_stress > 0.22
        ? "Veksten er under mål — automatiske verktøy-stopp brukes mer forsiktig."
        : "Det legges til rette for at bruk kan øke uten unødig friksjon.";
    hva_skjer_na = `Akkurat nå prioriterer motoren vekst i bruk og inntekt. ${tail}`;
  } else {
    hva_skjer_na =
      "Akkurat nå er modus balansert: verken margin eller vekst dominerer alene. Anbefalinger blander hensynene etter faktiske gap.";
  }

  const hva_forventer_vi =
    telemetry.checkpoint_period && telemetry.checkpoint_period < telemetry.overview_period
      ? "Vi forventer at anbefalinger og eventuelle auto-tiltak følger valgt strategi frem til neste månedlige sammenligning. Ved manuell strategi-overstyring gjelder valget deres til det nullstilles."
      : "Første perioder bygger sammenligningsgrunnlag. Vi forventer tydeligere vekst- og marginbilde etter neste lagrede sjekkpunkt. Inntil da er anbefalinger ekstra avhengige av ferske tall.";

  const effekt_i_korthet: string[] = [
    "Lavere Forretningsscore gir oftere forslag om kostkontroll (modellnivå, verktøybruk).",
    r.growth_gap_stress > 0.25
      ? "Høyt vekst-gap demper automatiske verktøy-inngrep slik at bruk ikke strupes."
      : "Margin-gap styrer hvor aggressivt systemet foreslår innsparinger.",
    r.strategy_forced
      ? "Strategi er låst (dashboard eller miljø) — automatisk modusbytte skjer ikke før lås oppheves."
      : "Strategi kan skifte automatisk når margin- og vekstbildet endrer seg (med rolig hysterese).",
  ];

  const dataSignal: TrustIndicatorSignal = t.revenue_partial ? "oppmerksom" : "god";
  const historikkSignal: TrustIndicatorSignal =
    telemetry.checkpoint_period && telemetry.checkpoint_period < telemetry.overview_period ? "god" : "middels";
  const laeringSignal = trustSignalFromSamples(telemetry.telemetry_samples);

  const tillit: TrustIndicator[] = [
    {
      title: "Datagrunnlag",
      body: t.revenue_partial
        ? "Delvis MRR-oppsett: ikke alle selskaper har full inntektsmodell — margin tolkes med forbehold."
        : "List MRR er satt for brukte planer — margin og inntektsbilde er sammenlignbare.",
      signal: dataSignal,
    },
    {
      title: "Sammenligning over tid",
      body:
        historikkSignal === "god"
          ? `Sjekkpunkt ${telemetry.checkpoint_period} gir meningsfull vekst- og marginutvikling mot ${telemetry.overview_period}.`
          : "Første sammenligning eller ny periode: vekstindikator bygges når historikk finnes.",
      signal: historikkSignal,
    },
    {
      title: "Erfaring fra drift",
      body:
        telemetry.telemetry_samples < 4
          ? "Få lagrede kjøringer per strategi — tallene modnes over tid."
          : `${telemetry.telemetry_samples} registrerte observasjoner på tvers av strategier gir stødigere erfaringsgrunnlag.`,
      signal: laeringSignal,
    },
    {
      title: "Åpen styring",
      body: r.strategy_override_source
        ? r.strategy_override_source === "dashboard"
          ? "Manuell strategi fra dashboard er synlig og kan tilbakestilles til automatikk."
          : "Miljølås er aktiv — endring krever konfigurasjon eller dashboard-overstyring der det er støttet."
        : "Ingen skjult lås: modus følger målt gap med forklart logikk.",
      signal: r.strategy_override_source === "env" ? "middels" : "god",
    },
  ];

  let konfNiva: string;
  let konfFork: string;
  if (t.revenue_partial || r.score < 0.38) {
    konfNiva = "Begrenset presisjon";
    konfFork =
      "Inntekts- eller marginbildet er ufullstendig, eller score er lav. Bruk anbefalinger som utgangspunkt og verifiser mot egen økonomi.";
  } else if (r.score >= 0.62 && historikkSignal === "god") {
    konfNiva = "Høy forklaringskraft";
    konfFork =
      "Gode data, historikk og score gir tryggere grunnlag for å stole på rangeringen av tiltak denne perioden.";
  } else {
    konfNiva = "Moderat forklaringskraft";
    konfFork =
      "Tallene er brukbare, men minst ett signal (margin, vekst eller historikk) er ikke optimalt — les anbefalingene som veiledning.";
  }

  if (telemetry.avg_recommendation_confidence != null) {
    konfFork += ` Anbefalte tiltak (snitt justert konfidens): ${pct1(telemetry.avg_recommendation_confidence)} %.`;
  }

  const historikkGod = Boolean(
    telemetry.checkpoint_period && telemetry.checkpoint_period < telemetry.overview_period,
  );
  const band = forretningsscoreBand(r.score);
  const ai_jobber_med = buildAiJobberMed(r);
  const prognose_7_dager = buildPrognose7Dager(overview, t.total_runs, r, nowMs);
  const styr = resolveStyringsanbefaling({
    r,
    overview,
    historikkGod,
    criticalRecs: Math.max(0, Math.floor(telemetry.critical_recommendation_count)),
  });

  const salg = buildSalgsblokk(r, overview, telemetry, historikkGod);

  return {
    headline: `${STRATEGY_LABEL_NB[r.strategy_mode]} · Forretningsscore ${pct(r.score)} %`,
    bullets,
    ...salg,
    ai_jobber_med,
    forretningsscore_band: band,
    forretningsscore_band_forklaring: forretningsscoreBandForklaringNb(band),
    prognose_7_dager,
    styringsanbefaling_kode: styr.kode,
    styringsanbefaling_tittel: styr.tittel,
    styringsanbefaling_begrunnelse: styr.begrunnelse,
    forretningsscore_hva_er_det,
    hva_skjer_na,
    hva_forventer_vi,
    effekt_i_korthet,
    tillit,
    konfidens: { niva: konfNiva, forklaring: konfFork },
  };
}

export type ResolvedPlatformObjective = {
  strategy_mode: StrategyMode;
  /** True when dashboard eller miljø låser modus (ikke ren automatikk). */
  strategy_forced: boolean;
  strategy_override_source: "dashboard" | "env" | null;
  /** Gaps vs base env targets (used for mode inference). */
  margin_gap_base: number;
  growth_gap_base: number;
  /** Targets after strategy shaping (used for scoring gaps below). */
  targets: ObjectiveTargetsResolved;
  base_targets: ObjectiveTargetsResolved;
  base_weights: BusinessObjectiveWeights;
  effective_weights: BusinessObjectiveWeights;
  achieved_growth_rel: number | null;
  margin_gap_stress: number;
  growth_gap_stress: number;
  score: number;
  exec: ObjectiveExecutionContext;
};

export type ResolvePlatformObjectiveOpts = {
  baseWeights?: BusinessObjectiveWeights;
  previous_strategy_mode?: StrategyMode | null;
  /** Dashboard + env chain; default in callers = resolveStrategyOverrideLayer(gov.business_engine). */
  strategy_override_layer?: StrategyOverrideLayer;
};

/**
 * Full pipeline: infer strategy → shape targets → gap-aware weights → score → execution + per-action bias.
 */
export function resolvePlatformObjective(
  overview: PlatformAiBillingOverview,
  prior: ObjectiveCheckpoint | null | undefined,
  opts?: ResolvePlatformObjectiveOpts,
): ResolvedPlatformObjective {
  const base = opts?.baseWeights ?? readObjectiveWeightsFromEnv();
  const base_targets = readObjectiveTargets(overview);
  const achieved = computeAchievedGrowthRel(overview.period, prior, overview.totals);
  const margin_gap_base = marginGapStress(
    overview.totals.margin_usd,
    overview.totals.revenue_partial,
    base_targets.target_margin_usd,
  );
  const growth_gap_base = growthGapStress(achieved, base_targets.target_growth_rel);

  const envForced = readStrategyOverrideFromEnv();
  const layer = opts?.strategy_override_layer ?? {
    mode: envForced,
    source: envForced ? ("env" as const) : null,
  };
  const forced = layer.mode;
  const strategy_forced = forced != null;
  const strategy_override_source = layer.source;
  const strategy_mode =
    forced ?? inferStrategyMode(margin_gap_base, growth_gap_base, opts?.previous_strategy_mode ?? null);

  const targets = applyStrategyToTargets(base_targets, strategy_mode);
  const mg = marginGapStress(
    overview.totals.margin_usd,
    overview.totals.revenue_partial,
    targets.target_margin_usd,
  );
  const gg = growthGapStress(achieved, targets.target_growth_rel);
  const afterGaps = adjustWeightsForTargetGaps(base, mg, gg);
  const effective_weights = applyStrategyToWeights(afterGaps, strategy_mode);
  const score = computeObjectiveScore(overview, prior, effective_weights);
  const exec = buildObjectiveExecutionContext(score, {
    margin_gap_stress: mg,
    growth_gap_stress: gg,
    effective_weights,
    strategy_mode,
  });
  return {
    strategy_mode,
    strategy_forced,
    strategy_override_source,
    margin_gap_base,
    growth_gap_base,
    targets,
    base_targets,
    base_weights: base,
    effective_weights,
    achieved_growth_rel: achieved,
    margin_gap_stress: mg,
    growth_gap_stress: gg,
    score,
    exec,
  };
}

/**
 * Maps objective score + target gaps to execution tuning.
 * Margin gap: stronger cost-control appetite. Growth gap: softer auto-throttle (see throttle_gap_scale).
 */
export function buildObjectiveExecutionContext(
  score: number,
  opts: {
    margin_gap_stress: number;
    growth_gap_stress: number;
    effective_weights: BusinessObjectiveWeights;
    strategy_mode: StrategyMode;
  },
): ObjectiveExecutionContext {
  const stress = clamp01(1 - score);
  const mg = clamp01(opts.margin_gap_stress);
  const gg = clamp01(opts.growth_gap_stress);
  const closure = clamp01(0.55 * mg + 0.25 * gg);
  const stressBlend = clamp01(stress * 0.72 + closure * 0.28);
  const mode = opts.strategy_mode;
  let downgrade_gap_scale = clamp01(0.93 + 0.14 * mg);
  let throttle_gap_scale = clamp01(1 - 0.2 * gg);
  if (mode === "profit") {
    downgrade_gap_scale = clamp01(downgrade_gap_scale * 1.05);
    throttle_gap_scale = clamp01(throttle_gap_scale * 0.94);
    if (mg > 0.18) {
      throttle_gap_scale = clamp01(throttle_gap_scale * 0.97);
    }
  } else if (mode === "growth") {
    downgrade_gap_scale = clamp01(downgrade_gap_scale * 0.95);
    throttle_gap_scale = clamp01(throttle_gap_scale * 1.06);
    if (gg > 0.18) {
      downgrade_gap_scale = clamp01(downgrade_gap_scale * 0.97);
    }
  }
  return {
    score,
    stress: stressBlend,
    strategy_mode: mode,
    margin_gap_stress: mg,
    growth_gap_stress: gg,
    effective_weights: opts.effective_weights,
    execution_confidence_mult: clamp01(0.88 + 0.2 * stressBlend + 0.06 * mg),
    min_auto_confidence_delta: -0.055 * stressBlend - 0.028 * mg,
    cooldown_multiplier_delta: -0.1 * stressBlend - 0.045 * mg,
    downgrade_gap_scale,
    throttle_gap_scale,
  };
}
