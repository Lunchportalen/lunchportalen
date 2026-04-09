/**
 * Controlled company layer — types shared by client + server (no side effects).
 * AI assists decisions; humans retain execution authority except explicit auto-safe path.
 */

import type { AllowedCompanyAction } from "./actionTypes";

export type CompanyExecutionMode = "manual" | "assisted" | "auto";

export type CompanyDecisionType = "ceo" | "growth" | "product" | "operations";

export type CompanyRiskLevel = "low" | "medium" | "high";

/** Input snapshot — assemble from SystemContext + optional revenue/design signals. */
export type CompanySnapshot = {
  rid: string;
  collectedAt: string;
  revenue: {
    pageViews24h: number;
    ctaClicks24h: number;
    ctr: number | null;
    conversions24h?: number;
  };
  design: {
    weakPointsCount: number;
    globalSpacingSection?: "tight" | "normal" | "wide";
  };
  content: {
    draftPages: number;
    contentHealthHint: number | null;
  };
  systemHealth: {
    status: "ok" | "degraded" | "unknown" | "down";
    errors24h: number;
    detail?: string;
  };
};

export type CompanyDecision = {
  id: string;
  type: CompanyDecisionType;
  action: string;
  confidence: number;
  reason: string;
  risk: CompanyRiskLevel;
  /** Where a human or safe auto-runner should act */
  channel: "design_optimizer" | "revenue_insights" | "cms_editor" | "system_ops" | "none";
  /** Stable policy allowlist key; when absent, {@link DECISION_ID_TO_ALLOWED_ACTION} is used. */
  allowedAction?: AllowedCompanyAction;
};

export type CompanyPolicyContext = {
  mode: CompanyExecutionMode;
  /** Unix ms of last autopilot execution (any channel) */
  lastAutopilotAt?: number | null;
  /** Ids already executed this session (client-supplied, optional) */
  executedDecisionIds?: string[];
  /** Assisted / execute path: decision ids explicitly approved in this request */
  explicitApproveIds?: readonly string[] | null;
  /** Human override — permits execution despite normal denials (must be logged). */
  forceOverride?: boolean;
  /** Per-target cooldown keys (e.g. spacing.section) → last applied unix ms */
  targetCooldownLastAt?: Record<string, number> | null;
  /** KPI / safety rollback signal — blocks execution */
  negativeImpactObserved?: boolean;
  /** Any anomaly present — auto mode denied at policy layer */
  hasAnomalies?: boolean;
};

export type CompanyPolicyResult = {
  allowed: boolean;
  reason: string;
  riskLevel: CompanyRiskLevel;
  allowedAction: AllowedCompanyAction | null;
  override?: boolean;
};

/** Batch overlap cooldown — not tied to a single decision envelope. */
export type CompanyBatchCooldownResult = {
  allowed: boolean;
  reason: string;
};

/** Immutable audit row for intelligence `policy_decision` payloads. */
export type CompanyPolicyDecisionLogEntry = {
  decisionId: string;
  allowedAction: AllowedCompanyAction | null;
  allowed: boolean;
  reason: string;
  riskLevel: CompanyRiskLevel;
  mode: CompanyExecutionMode;
  override?: boolean;
};

export type CompanyAutomationQueuedItem = {
  decision: CompanyDecision;
  policy: CompanyPolicyResult;
};

export type CompanyAutomationExecutable = {
  decision: CompanyDecision;
  policy: CompanyPolicyResult;
  /** Only present when auto-safe path applies */
  designPatch?: import("@/lib/cms/design/designContract").DesignSettingsDocument;
};
