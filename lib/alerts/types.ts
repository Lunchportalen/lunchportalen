/**
 * Finansielle og operative varsler — serialiserbare, forklarbare.
 */

export type AlertType =
  | "profit_drop"
  | "no_revenue"
  | "roas_drop"
  | "high_spend_low_return"
  | "sudden_spike"
  | "winner_detected";

export type AlertSeverity = "low" | "medium" | "high";

export type Alert = {
  id: string;
  type: AlertType;
  message: string;
  severity: AlertSeverity;
  timestamp: number;
  context?: Record<string, unknown>;
};

/** Før id/timestamp settes i motor. */
export type AlertSeed = Omit<Alert, "id" | "timestamp">;

export type FinancialAlertRunInput = {
  /** Kun varsler når kilde er pålitelig. */
  dataTrusted: boolean;
  revenueToday: number;
  revenueYesterday: number;
  /** Daglig netto/profit når tilgjengelig; ellers brukes omsetningsproxy i motor. */
  profitToday: number | null;
  profitYesterday: number | null;
  adSpend: number;
  adSpendKnown: boolean;
  /** Oslo time 0–23 — brukes til å unngå falske «ingen omsetning» tidlig på dagen. */
  osloHour: number;
  ordersCountedToday: number;
  /** ROAS nå / før (valgfritt; ofte null inntil integrasjon). */
  roasCurrent: number | null;
  roasPrevious: number | null;
};

export type ControlTowerFinancialAlerts = {
  triggered: Alert[];
  suppressed: Array<{ type: AlertType; reason: string }>;
  /** ok = ordredata tilgjengelig; degraded = utilgjengelig (ingen falske finansvarsler). */
  systemStatus: "ok" | "degraded";
};
