/**
 * Extended build readiness state machine (Phase 15G).
 * Commercial ACTIVE in market_approvals remains separate and fail-closed.
 */

export const BUILD_STATES = [
  "DRAFT",
  "RESEARCHED",
  "TAX_CONFIGURED",
  "LEGAL_CONFIGURED",
  "LOCALIZED",
  "STAGING_CERTIFIED",
  "EXTERNAL_REVIEW_APPROVED",
  "READY_FOR_GLOBAL_CUTOVER",
  "ACTIVE",
] as const;

export type BuildState = (typeof BUILD_STATES)[number];

const ALLOWED: Record<BuildState, readonly BuildState[]> = {
  DRAFT: ["RESEARCHED"],
  RESEARCHED: ["TAX_CONFIGURED", "DRAFT"],
  TAX_CONFIGURED: ["LEGAL_CONFIGURED", "RESEARCHED"],
  LEGAL_CONFIGURED: ["LOCALIZED", "TAX_CONFIGURED"],
  LOCALIZED: ["STAGING_CERTIFIED", "LEGAL_CONFIGURED"],
  STAGING_CERTIFIED: ["EXTERNAL_REVIEW_APPROVED", "LOCALIZED"],
  EXTERNAL_REVIEW_APPROVED: ["READY_FOR_GLOBAL_CUTOVER", "STAGING_CERTIFIED"],
  READY_FOR_GLOBAL_CUTOVER: ["ACTIVE", "EXTERNAL_REVIEW_APPROVED"],
  ACTIVE: [],
};

export function canTransitionBuildState(from: BuildState, to: BuildState): boolean {
  return ALLOWED[from].includes(to);
}

export function assertNoShortcutToActive(from: BuildState, to: BuildState): void {
  if (to === "ACTIVE" && from !== "READY_FOR_GLOBAL_CUTOVER") {
    throw new Error(`BUILD_STATE_SHORTCUT_FORBIDDEN:${from}->${to}`);
  }
  if (!canTransitionBuildState(from, to)) {
    throw new Error(`BUILD_STATE_TRANSITION_FORBIDDEN:${from}->${to}`);
  }
}

/**
 * Global all-or-nothing activation gate.
 * Requires 21/21 READY_FOR_GLOBAL_CUTOVER before ACTIVE transaction.
 */
export function assertGlobalActivationReady(states: Record<string, BuildState>): void {
  const required = [
    "NO", "SE", "DK", "FI", "GB", "DE", "FR", "ES", "IT", "NL",
    "BE", "CH", "AT", "IE", "PL", "RO", "CZ", "PT", "GR", "US", "CA",
  ];
  const notReady = required.filter((c) => states[c] !== "READY_FOR_GLOBAL_CUTOVER");
  if (notReady.length > 0) {
    throw new Error(`GLOBAL_ACTIVATION_BLOCKED:${notReady.join(",")}`);
  }
}
