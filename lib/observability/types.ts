// lib/observability/types.ts
// Canonical observability model: SLO definitions, SLI results, alert state, operational status.
// All metrics/SLIs must map to actual code paths, runtime facts, or persisted events.

export type SliStatus = "ok" | "warn" | "breach" | "unknown";

export type SloId =
  | "system_health"
  | "cron_outbox"
  | "cron_critical"
  | "order_write"
  | "auth_protected_route"
  | "content_publish";

/**
 * Logical service/component identifiers used for grouping SLOs and alerts.
 * Keep this narrow and explicit to avoid scattering magic strings.
 */
export type ServiceId =
  | "core_system"
  | "cron"
  | "orders"
  | "auth"
  | "cms";

/** Single SLO definition: target, window, thresholds. */
export type SloDefinition = {
  id: SloId;
  /** Owning service/component for this SLO. */
  serviceId: ServiceId;
  name: string;
  description: string;
  /** SLI is computed from this key (maps to data source). */
  sliKey: string;
  /** Target success rate 0–100 (e.g. 99.5). */
  targetPercent: number;
  /** Rolling window in minutes for SLI calculation. */
  windowMinutes: number;
  /** Below this % → critical/breach. */
  criticalThresholdPercent: number;
  /** Below this % → warning. */
  warnThresholdPercent: number;
  /** How SLI is measured (for docs). */
  measurementNote: string;
  /** Optional operator guidance when this SLO is degraded or breached. */
  operatorHint?: string;
};

/** Result of computing one SLI (raw numerator/denominator + rate). */
export type SliResult = {
  sloId: SloId;
  sliKey: string;
  /** Logical owner of this SLI. */
  serviceId?: ServiceId;
  /** Success count in window. */
  good: number;
  /** Total count in window (or sample size). */
  total: number;
  /** good/total as 0–100, or null if no data. */
  ratePercent: number | null;
  status: SliStatus;
  message: string;
  /**
   * Optional current measurement window.
   * If omitted, consumers may fall back to SloDefinition.windowMinutes.
   */
  windowMinutes?: number;
  windowStart?: string; // ISO
  windowEnd?: string; // ISO
  /**
   * Optional error budget remaining in percent (0–100).
   * Example: 100 - ratePercent over the SLO window.
   */
  errorBudgetPercent?: number | null;
  /** Optional evidence (e.g. last_check_ts, last_error). */
  evidence?: Record<string, unknown>;
};

/** Alert severity for operator consumption. */
export type AlertSeverity = "critical" | "warning" | "info";

/** One alert-ready state (breach or sustained degradation). */
export type AlertState = {
  sloId: SloId;
  /** Logical service/component this alert belongs to. */
  serviceId?: ServiceId;
  severity: AlertSeverity;
  message: string;
  sliRatePercent: number | null;
  thresholdPercent: number;
  since: string; // ISO
  rid?: string | null;
  /** Suggested operator action / next step (human readable). */
  operatorHint?: string;
  evidence?: Record<string, unknown>;
};

/** Canonical operational status: single source of truth. */
export type OperationalStatus = {
  status: "normal" | "degraded" | "critical";
  ts: string; // ISO
  rid: string | null;
  /** Health checks (from runHealthChecks / snapshots). */
  checks: Array<{ key: string; status: "OK" | "WARN" | "FAIL"; message: string }>;
  /** Computed SLI results per SLO. */
  slos: Array<SliResult>;
  /** Active alerts (breach or warning). */
  alerts: AlertState[];
  /** Open system incidents count by type. */
  openIncidentsByType: Record<string, number>;
  /** Human-readable reasons for degraded/critical. */
  reasons: string[];
};
