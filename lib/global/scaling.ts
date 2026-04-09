/**
 * Globale tak per marked (kontroll-lag — deterministisk).
 * Faktisk salgsagent bruker egne grenser i `selectLeadsForOutreach` m.m.
 */

export const GLOBAL_SCALING = {
  /** Maks markeder som kan kjøres i én global batch (sikkerhetsventil). */
  maxMarketsPerRun: 8,
  /** Hint for fremtidige rate-limit-nøkler per marked. */
  maxOrchestratedActionsPerMarketPerRun: 20,
} as const;
