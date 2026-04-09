/**
 * Bump experiment_key i DB + ny LS-nøkkel ved nye varianter.
 *
 * Læring: `ai_demo_cta_ab_state` (global + `pattern_learning_by_context` per `d:device|i:intent`) + `ai_demo_ab_context_state`.
 * Rebalanse kan spawne nye CTA-tekster (`g1` …) fra beste performere; frø a/b beholdes.
 */
export const DEMO_CTA_AB_EXPERIMENT_KEY = "demo_cta_v1";

export const DEMO_CTA_AB_LS_KEY = `lp_ai_demo_cta_ab_${DEMO_CTA_AB_EXPERIMENT_KEY}`;

/** Variant-ID (frø a/b + genererte g1, g2, …). Valider med `isValidDemoCtaVariantId`. */
export type DemoCtaVariantKey = string;

export const DEMO_CTA_VARIANT_LABELS = {
  a: "Prøv med dine egne tall",
  b: "Start med din bedrift — se ekte oppsett",
} as const satisfies Record<"a" | "b", string>;

export const DEMO_CTA_VARIANT_KEYS: Array<"a" | "b"> = ["a", "b"];

/** Maks antall varianter i test (frø + genererte). */
export const DEMO_CTA_AB_MAX_VARIANTS = 5;

/** Maks nye tekster generert per eksperiment (uten å fjerne vinnere). */
export const DEMO_CTA_AB_MAX_GENERATED = 3;

/** Min score-gap mellom topp to før vi spawner ny variant (0–1 skala). */
export const DEMO_CTA_AB_SPAWN_MIN_SCORE_GAP = 0.055;

/** Minst timer mellom nye genererte varianter. */
export const DEMO_CTA_AB_SPAWN_COOLDOWN_HOURS = 36;

/** Andel trukket fra leder for å gi ny variant luft. */
export const DEMO_CTA_AB_SPAWN_STEAL_FROM_LEADER = 0.07;

/** Minimum visninger per variant før auto-justering. */
export const DEMO_CTA_AB_MIN_IMPRESSIONS = 40;

/** Vindu for aggregering. */
export const DEMO_CTA_AB_STATS_DAYS = 14;

/** Minst én rebalance per intervall (sekunder). */
export const DEMO_CTA_AB_REBALANCE_COOLDOWN_SEC = 3600;

/** Glatting: nye vekter = (1-α)·gamle + α·mål (0–1). */
export const DEMO_CTA_AB_SMOOTH_ALPHA = 0.2;

/** Minimum andel per variant (unngår 100/0). */
export const DEMO_CTA_AB_WEIGHT_FLOOR = 0.12;

/** Minimum visninger per variant i én kontekst-bucket før læring skriver om vekter. */
export const DEMO_CTA_AB_CONTEXT_MIN_IMPRESSIONS = 28;

/** Tidligere læringsaggregering vektet inn i nytt vindu (0–1). */
export const DEMO_CTA_AB_FEATURE_LEARN_DECAY = 0.82;

/** Generert variant «promoteres» til frø-status (beskyttet) ved sterk score. */
export const DEMO_CTA_AB_PROMOTE_MIN_SCORE = 0.088;

export const DEMO_CTA_AB_PROMOTE_MIN_IMPRESSIONS = 72;

/** Maks lengde på `variant_performance_history` (JSON). */
export const DEMO_CTA_AB_HISTORY_MAX = 180;

/** Standard forretningsstrategi for generert copy (DB-kolonne `strategy_mode` overstyrer). */
export const DEMO_CTA_AB_DEFAULT_STRATEGY_MODE = "balance" as const;

/** Minimum vinner-tillit før auto-spawn (Wilson-bånd + volum; under min data kan gap fortsatt være reelt). */
export const DEMO_CTA_AB_SPAWN_MIN_TOP_CONFIDENCE = 0.28;

/** Minste samlede visninger (alle varianter) i ett mønster-kontekst før spawn bruker den konteksten. */
export const DEMO_CTA_AB_PATTERN_CONTEXT_MIN_IMPRESSIONS = 24;
