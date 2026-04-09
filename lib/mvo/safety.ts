/** Maks antall MVO-kombinasjoner per planlagt kjøring (unngår eksplosjon). */
export const MAX_COMBOS_PER_RUN = 3;

/** Alias: nye combo-kandidater per cron (bundet). */
export const MAX_NEW_COMBOS_PER_CRON = MAX_COMBOS_PER_RUN;

/** Maks andel trafikk som kan tilordnes «ny» combo (deterministisk hash — se `traffic.ts`). */
export const MAX_NEW_COMBO_TRAFFIC_FRACTION = 0.5;

/**
 * Utforsking: `hash % EXPLORATION_FRACTION_DENOMINATOR === 0` gir ~`1/denominator` trafikk (standard 20 %).
 */
export const EXPLORATION_FRACTION_DENOMINATOR = 5;

/**
 * Om inntekt faller under denne andelen av forrige beste loggede verdi, marker rollback (ingen strategi-boost).
 */
export const ROLLBACK_REVENUE_RATIO = 0.9;
