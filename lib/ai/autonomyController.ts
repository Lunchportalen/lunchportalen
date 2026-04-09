/**
 * Kontrollert autonomi — ingen auto-utførelse.
 * Nivå 0: observer | 1: anbefal | 2: forhåndsutfyll (kun data til UI, ikke submit).
 */

export type AutonomyLevel = 0 | 1 | 2;

export type AutonomyMode = "observe" | "recommend" | "assist";

export function normalizeAutonomyLevel(v: unknown): AutonomyLevel {
  const n = Math.floor(Number(v));
  if (n <= 0) return 0;
  if (n >= 2) return 2;
  return 1;
}

export function modeForLevel(level: AutonomyLevel): AutonomyMode {
  if (level <= 0) return "observe";
  if (level === 1) return "recommend";
  return "assist";
}

export type DecisionPresentation = {
  /** Vises som ren innsikt (ingen handlingsknapper). */
  observeOnly: boolean;
  /** Godkjenn/avslå tillatt (menneske i løkken). */
  showApproveReject: boolean;
  /** Ekstra «prefyll»-hint for skjema/ERP (kun tekst/JSON — ingen POST). */
  assistPrefill: Record<string, unknown> | null;
};

/**
 * Ingen auto-exec: level styrer kun presentasjon og om feedback-knapper vises.
 */
export function presentationForDecision(opts: {
  level: AutonomyLevel;
  policyAllowed: boolean;
  /** Minimum konfidans for å vise som anbefaling (0–1). */
  minConfidenceForRecommend: number;
  confidence: number;
}): DecisionPresentation {
  if (!opts.policyAllowed) {
    return { observeOnly: true, showApproveReject: false, assistPrefill: null };
  }

  if (opts.level <= 0) {
    return { observeOnly: true, showApproveReject: false, assistPrefill: null };
  }

  const strongEnough = opts.confidence >= opts.minConfidenceForRecommend;
  if (!strongEnough) {
    return { observeOnly: true, showApproveReject: false, assistPrefill: null };
  }

  if (opts.level === 1) {
    return { observeOnly: false, showApproveReject: true, assistPrefill: null };
  }

  return {
    observeOnly: false,
    showApproveReject: true,
    assistPrefill: { note: "Nivå 2: bruk som utkast i innkjøps-/prissystem — send aldri automatisk." },
  };
}
