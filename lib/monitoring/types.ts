/**
 * SRE monitoring: anomaly alerts (baseline vs current), non-blocking, explainable.
 */

export type MonitoringSeverity = "low" | "medium" | "high";

export type MonitoringAlertType = "error_spike" | "latency" | "revenue_drop";

export type MonitoringAlert = {
  type: MonitoringAlertType;
  severity: MonitoringSeverity;
  message: string;
  /** Human-readable numbers for operators */
  explain: string;
};

export type MonitoringCurrent = {
  errors: number;
  /** Null when no latency samples in window */
  latency: number | null;
  revenue: number;
  leadPipelineRecentWrites: number;
};
