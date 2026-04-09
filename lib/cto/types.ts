/**
 * CTO-strategi — typer for datainnsamling, modell og roadmap.
 * Omsetning følger ordre: `line_total` med fallback til `total_amount`.
 */

export type CtoOrderRow = Record<string, unknown>;
export type CtoLeadRow = Record<string, unknown>;
export type CtoLogRow = Record<string, unknown>;

export type CtoCollectedData = {
  orders: CtoOrderRow[];
  leads: CtoLeadRow[];
  logs: CtoLogRow[];
};

export type BusinessModel = {
  revenue: number;
  leads: number;
  orders: number;
  /** lead → order (0 hvis leads = 0). */
  conversion: number;
  /** Antall rader i ai_activity_log (samme vindu som innsamling). */
  activityLogRows: number;
};

export type CtoIssue = {
  type: string;
  message: string;
  impact: "high" | "medium" | "low";
  /** Sporbarhet: hvorfor flagget ble satt. */
  explain: string;
};

export type CtoOpportunity = {
  action: string;
  impact: "high" | "medium" | "low";
  /** Relativ forventet effekt (0–1), ikke kr — brukes kun til sortering. */
  expectedRevenueLift: number;
  explain: string;
};

export type CtoStrategyRow = {
  priority: number;
  action: string;
  expectedImpact: number;
  explain: string;
};
