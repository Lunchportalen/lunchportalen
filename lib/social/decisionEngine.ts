/**
 * Beslutningsobjekter for kontrollert autonom SoMe-motor (ren data — ingen sideeffekter).
 * Prognose leses ikke inn her — kun i logger/automation (se `predictiveSummaryFromCalendar`, ingen auto-utførelse).
 */

export type RiskLevel = "low" | "medium" | "high";

/** UI / kjøringsmodus for autonomi (ingen server-only). */
export type AutonomyAggressiveness = "low" | "medium" | "high";

/** Tillatte handlingstyper + eldre alias + publish (kun policy-sjekk, aldri utført). */
export type ActionType =
  | "generate_post"
  | "schedule_post"
  | "promote_product"
  | "adjust_timing"
  | "boost_existing"
  | "deprioritize"
  | "publish"
  | "generate"
  | "schedule"
  | "promote";

export type DecisionType = ActionType;

export type Decision = {
  id: string;
  type: ActionType;
  reason: string;
  /** 0–1 — under terskel avvises av policy (fail-closed). */
  confidence: number;
  /** 0–1 heuristikk for forventet effekt (prognose-hook, ikke fasit). */
  expectedImpact?: number;
  riskLevel: RiskLevel;
  data: Record<string, unknown>;
  approved: boolean;
  executed: boolean;
  /** Epoch ms — sporbarhet. */
  timestamp: number;
  /** Når beslutningen ikke kjøres (policy, duplikat, kvote, pause). */
  skipReason?: string;
};

export type CreateDecisionInput = {
  type: ActionType;
  reason: string;
  confidence: number;
  data?: Record<string, unknown>;
  expectedImpact?: number;
  riskLevel?: RiskLevel;
  timestamp?: number;
};

function newDecisionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createDecision(input: CreateDecisionInput): Decision {
  const ts = typeof input.timestamp === "number" && Number.isFinite(input.timestamp) ? input.timestamp : Date.now();
  return {
    id: newDecisionId(),
    type: input.type,
    reason: input.reason,
    confidence: input.confidence,
    expectedImpact: input.expectedImpact,
    riskLevel: input.riskLevel ?? "low",
    data: input.data && typeof input.data === "object" ? { ...input.data } : {},
    approved: false,
    executed: false,
    timestamp: ts,
  };
}

/** Stabil nøkkel for duplikat-sjekk innen én kjøring. */
export function decisionDedupeKey(d: Decision): string {
  const keys = Object.keys(d.data).sort();
  const payload = keys.map((k) => `${k}:${JSON.stringify(d.data[k])}`).join("|");
  return `${d.type}:${payload}`;
}
